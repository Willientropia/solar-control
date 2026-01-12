#!/usr/bin/env python3
"""
Script para extrair dados de faturas de energia em PDF.
Adaptado para uso via linha de comando, retornando JSON.
"""

import sys
import json
import re
import argparse

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed"}))
    sys.exit(1)

try:
    import pytesseract
    from PIL import Image
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


def extract_text_from_pdf(pdf_path):
    """Extrai texto do PDF, utilizando OCR se necessário."""
    text = ''
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text
                elif HAS_OCR:
                    image = page.to_image(resolution=300).original
                    ocr_text = pytesseract.image_to_string(image, lang='por')
                    text += ocr_text
    except Exception as e:
        return None, str(e)
    return text, None


def extract_address(text):
    """Captura o endereço a partir do texto."""
    match = re.search(r'(RUA .*?\n.*?CEP: .*?BRASIL)', text, re.DOTALL)
    return match.group(1).replace("\n", " ") if match else None


def extract_reference_month_and_due_date(text):
    """Captura o mês de referência e a data de vencimento."""
    match = re.search(r'CFOP \d{4}:.*?\n(\w{3}/\d{4})\s+(\d{2}/\d{2}/\d{4})', text)
    if match:
        return {
            'mesReferencia': match.group(1),
            'dataVencimento': match.group(2)
        }
    return {
        'mesReferencia': None,
        'dataVencimento': None
    }


def extract_uc_info(text):
    """Captura a informação da Unidade Consumidora (UC)."""
    try:
        match = re.search(r'Consulte pela Chave de Acesso em:\s*(\d+)', text)
        if match:
            return match.group(1)
        return None
    except Exception:
        return None


def extract_reading_info(text):
    """Captura as informações de leitura anterior, leitura atual e quantidade de dias."""
    try:
        match = re.search(r'(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+(\d+)', text)
        if match:
            return {
                'leituraAnterior': match.group(1),
                'leituraAtual': match.group(2),
                'quantidadeDias': match.group(3)
            }
        return {
            'leituraAnterior': None,
            'leituraAtual': None,
            'quantidadeDias': None
        }
    except Exception:
        return {
            'leituraAnterior': None,
            'leituraAtual': None,
            'quantidadeDias': None
        }


def extract_client_name(text):
    """Captura o nome do cliente a partir do texto."""
    try:
        match = re.search(r'Tensão Nominal Disp: .*?\n(.*?)\n', text)
        if match:
            return match.group(1)
        return None
    except Exception:
        return None


def extract_balance(text):
    """Captura o saldo de energia (KWH) no texto."""
    match = re.search(r'SALDO KWH:\s*([\d\.,]+)', text)
    if match:
        return match.group(1).strip().rstrip(',')
    return None


def sanitize_to_float(value):
    """Converte um valor para float, lidando com strings formatadas."""
    if isinstance(value, str):
        try:
            return float(value.replace('.', '').replace(',', '.'))
        except ValueError:
            return 0.0
    elif isinstance(value, (int, float)):
        return float(value)
    return 0.0


def extract_data_from_text(text, pdf_path):
    """Processa o texto extraído para buscar dados específicos."""
    data = {
        'pdfPath': pdf_path,
        'extractionErrors': []
    }

    # CPF/CNPJ
    try:
        match = re.search(r'CNPJ/CPF: (\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})', text)
        data['cpfCnpj'] = match.group(1) if match else None
    except Exception:
        data['cpfCnpj'] = None
        data['extractionErrors'].append('CPF/CNPJ')

    # Consumo (kWh)
    try:
        match = re.search(r'CONSUMO.*?(\d+\,\d+)', text)
        data['consumoKwh'] = match.group(1) if match else None
    except Exception:
        data['consumoKwh'] = None
        data['extractionErrors'].append('Consumo kWh')

    # Valor Total
    try:
        match = re.search(r'R\$[*]+([\d.,]+)', text)
        data['valorTotal'] = match.group(1) if match else None
    except Exception:
        data['valorTotal'] = None
        data['extractionErrors'].append('Valor Total')

    # Saldo de Energia
    data['saldoKwh'] = extract_balance(text)

    # Nome do Cliente
    data['nomeCliente'] = extract_client_name(text)

    # Endereço
    data['endereco'] = extract_address(text)

    # Unidade Consumidora
    data['unidadeConsumidora'] = extract_uc_info(text)

    # Informações de Leitura
    reading_info = extract_reading_info(text)
    data.update(reading_info)

    # Mês de Referência e Data de Vencimento
    ref_due_info = extract_reference_month_and_due_date(text)
    data.update(ref_due_info)

    # Contribuição de Iluminação Pública
    try:
        match = re.search(r'CONTRIB\.\s+ILUM\.\s+PÚBLICA\s+-\s+MUNICIPAL\s+(\d{1,3}(?:\.\d{3})*,\d{2})', text)
        data['contribuicaoIluminacao'] = match.group(1) if match else "0"
    except Exception:
        data['contribuicaoIluminacao'] = "0"
        data['extractionErrors'].append('Contribuição Iluminação')

    # Injeção SCEE
    try:
        match = re.search(r'INJEÇÃO SCEE.*?\s(\d+\,\d+).*?\s(\d+\,\d+)', text)
        if match:
            data['energiaInjetada'] = match.group(1)
            data['precoEnergiaInjetada'] = match.group(2)
        else:
            data['energiaInjetada'] = None
            data['precoEnergiaInjetada'] = None
    except Exception:
        data['energiaInjetada'] = None
        data['precoEnergiaInjetada'] = None

    # Consumo SCEE
    try:
        match = re.search(r'CONSUMO SCEE.*?\s(\d+\,\d+).*?\s(\d+\,\d+)', text)
        if match:
            data['consumoScee'] = match.group(1)
            data['precoEnergiaCompensada'] = match.group(2)
        else:
            data['consumoScee'] = None
            data['precoEnergiaCompensada'] = None
    except Exception:
        data['consumoScee'] = None
        data['precoEnergiaCompensada'] = None

    # Preço do Fio B
    try:
        match = re.search(r'PARC INJET S/DESC.*?\d+\,\d+.*?\d+\,\d+.*?\s(\d+\,\d+)', text)
        data['precoFioB'] = match.group(1) if match else None
    except Exception:
        data['precoFioB'] = None

    # Consumo Não Compensado e Preço do kWh Não Compensado
    try:
        match = re.search(r'CONSUMO NÃO COMPENSADO.*?(\d+\,\d+)', text)
        if match:
            data['consumoNaoCompensado'] = match.group(1)
            preco_match = re.search(r'CONSUMO NÃO COMPENSADO.*?\d+\,\d+.*?\s(\d+\,\d+)', text)
            data['precoKwhNaoCompensado'] = preco_match.group(1) if preco_match else None
        else:
            data['consumoNaoCompensado'] = "0"
            data['precoKwhNaoCompensado'] = "0"
    except Exception:
        data['consumoNaoCompensado'] = "0"
        data['precoKwhNaoCompensado'] = "0"

    # Preço do ADC Bandeira
    try:
        match = re.search(r'ADC BANDEIRA.*?\d+\,\d+.*?\s(\d+\,\d+)', text)
        data['precoAdcBandeira'] = match.group(1) if match else "0"
    except Exception:
        data['precoAdcBandeira'] = "0"

    # Geração do Ciclo
    try:
        match = re.search(r'GERAÇÃO CICLO \((\d{2}/\d{4})\) KWH: UC (\d+) : ([\d\.\,]+)', text)
        if match:
            data['cicloGeracao'] = match.group(1)
            data['ucGeradora'] = match.group(2)
            data['geracaoUltimoCiclo'] = match.group(3).strip().rstrip(',')
        else:
            data['cicloGeracao'] = None
            data['ucGeradora'] = None
            data['geracaoUltimoCiclo'] = None
    except Exception:
        data['cicloGeracao'] = None
        data['ucGeradora'] = None
        data['geracaoUltimoCiclo'] = None

    return data


def calculate_values(data, price_kwh, discount_percent):
    """Calcula os valores com e sem desconto."""
    try:
        consumo_scee = sanitize_to_float(data.get('consumoScee', '0'))
        consumo_nao_compensado = sanitize_to_float(data.get('consumoNaoCompensado', '0'))
        contribuicao = sanitize_to_float(data.get('contribuicaoIluminacao', '0'))

        # Valor sem desconto (como seria sem energia solar)
        valor_sem_desconto = ((consumo_scee + consumo_nao_compensado) * price_kwh) + contribuicao
        data['valorSemDesconto'] = round(valor_sem_desconto, 2)

        # Valor com desconto
        discount_multiplier = 1 - (discount_percent / 100)
        valor_com_desconto = ((consumo_scee + consumo_nao_compensado) * price_kwh * discount_multiplier) + contribuicao
        data['valorComDesconto'] = round(valor_com_desconto, 2)

        # Economia
        data['economia'] = round(valor_sem_desconto - valor_com_desconto, 2)

        # Lucro (50% da economia como exemplo)
        data['lucro'] = round(data['economia'] * 0.5, 2)

    except Exception as e:
        data['calculationError'] = str(e)

    return data


def main():
    parser = argparse.ArgumentParser(description='Extrai dados de faturas de energia em PDF')
    parser.add_argument('pdf_path', help='Caminho do arquivo PDF')
    parser.add_argument('--price-kwh', type=float, default=0.85, help='Preço do kWh no mercado cativo')
    parser.add_argument('--discount', type=float, default=25.0, help='Desconto percentual')
    
    args = parser.parse_args()

    # Extrai texto do PDF
    text, error = extract_text_from_pdf(args.pdf_path)
    
    if error:
        print(json.dumps({
            'success': False,
            'error': f'Erro ao ler PDF: {error}'
        }))
        sys.exit(1)

    if not text:
        print(json.dumps({
            'success': False,
            'error': 'Não foi possível extrair texto do PDF'
        }))
        sys.exit(1)

    # Extrai dados
    data = extract_data_from_text(text, args.pdf_path)
    
    # Calcula valores
    data = calculate_values(data, args.price_kwh, args.discount)
    
    # Adiciona flag de sucesso
    data['success'] = True
    data['precoKwhUsado'] = args.price_kwh
    data['descontoUsado'] = args.discount

    # Retorna JSON
    print(json.dumps(data, ensure_ascii=False))


if __name__ == "__main__":
    main()
