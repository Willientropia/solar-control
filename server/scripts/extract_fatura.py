#!/usr/bin/env python3
"""
Script para extrair dados de faturas de energia em PDF.
Suporta os dois layouts da Equatorial Goiás (variação de posição dos campos).
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
    text = ''
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                elif HAS_OCR:
                    try:
                        image = page.to_image(resolution=300).original
                        ocr_text = pytesseract.image_to_string(image, lang='por')
                        text += ocr_text + "\n"
                    except Exception:
                        pass  # página sem texto e sem OCR disponível — ignora
    except Exception as e:
        return None, str(e)
    return text, None


def extract_cpf_cnpj(text):
    match = re.search(r'CNPJ/CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})', text)
    return match.group(1) if match else None


def extract_valor_total(text):
    match = re.search(r'R\$[*]+([\d.,]+)', text)
    return match.group(1) if match else None


def extract_balance(text):
    match = re.search(r'SALDO KWH:\s*([\d\.,]+)', text)
    if match:
        return match.group(1).strip().rstrip(',')
    return None


def extract_contribuicao(text):
    match = re.search(r'CONTRIB\.\s+ILUM\.\s+P.BLICA\s+-\s+MUNICIPAL\s+([\d\.,]+)', text)
    return match.group(1) if match else "0"


def extract_consumo_scee(text):
    # Linha: "CONSUMO SCEE kWh 168,00 0,780764 ..."
    match = re.search(r'CONSUMO SCEE\s+kWh\s+([\d\.,]+)\s+([\d\.]+)', text)
    if match:
        return match.group(1), match.group(2)
    return None, None


def extract_injecao_scee(text):
    # Primeira linha de injeção: "INJEÇÃO SCEE - UC xxx kWh 168,00 0,780764 ..."
    match = re.search(r'INJE..O SCEE.*?kWh\s+([\d\.,]+)\s+([\d\.]+)', text)
    if match:
        return match.group(1), match.group(2)
    return None, None


def extract_consumo_nao_compensado(text):
    match = re.search(r'CONSUMO N.O COMPENSADO.*?kWh\s+([\d\.,]+)\s+([\d\.]+)', text)
    if match:
        return match.group(1), match.group(2)
    # sem kWh explícito
    match = re.search(r'CONSUMO N.O COMPENSADO.*?([\d]+\,[\d]+)', text)
    if match:
        return match.group(1), None
    return "0", "0"


def extract_fio_b(text):
    """
    Linha (pode estar quebrada em duas):
    "PARC INJET S/DESC - 28,57% - UC xxx - GD\nII 2 kWh 168,00 0,175126 29,42 0,175126"
    Formato: kWh <quantidade> <precoFioB> <valor> <precoFioB_repetido>
    O preço do Fio B é o ÚLTIMO número da sequência.
    """
    # Junta a linha quebrada (PARC INJET pode ter \n antes de "kWh")
    normalized = re.sub(r'\n', ' ', text)
    match = re.search(
        r'PARC INJET S/DESC.*?kWh\s+[\d\.,]+\s+([\d\.,]+)\s+[\d\.,]+\s+([\d\.,]+)',
        normalized
    )
    if match:
        return match.group(2)  # último valor = preço Fio B repetido
    return None


def extract_adc_bandeira(text):
    match = re.search(r'ADC BANDEIRA.*?\s([\d\.]+)$', text, re.MULTILINE)
    return match.group(1) if match else "0"


def extract_ciclo_geracao(text):
    # "GERAÇÃO CICLO (3/2026) KWH: UC 10040141363 : 8.765,98, UC ..."
    match = re.search(r'GERA..O CICLO \((\d{1,2}/\d{4})\) KWH: UC (\d+) : ([\d\.\,]+)', text)
    if match:
        return match.group(1), match.group(2), match.group(3).strip().rstrip(',')
    return None, None, None


def extract_client_name(text):
    # Nome aparece após "Tensão Nominal Disp: xxx V..." na linha seguinte
    match = re.search(r'Tens.o Nominal Disp:.*?\n(.*?)\n', text)
    if match:
        candidate = match.group(1).strip()
        if candidate and not re.match(r'^(RUA|AV|R\$|CEP|\d|CNPJ)', candidate, re.IGNORECASE):
            return candidate
    # Fallback: nome logo antes do CNPJ/CPF
    match = re.search(r'\n([\w\s]+)\nCNPJ/CPF:', text)
    if match:
        candidate = match.group(1).strip()
        if len(candidate) > 3:
            return candidate
    return None


def extract_address(text):
    # Captura do primeiro "RUA/AV/..." até "BRASIL" na mesma sequência
    match = re.search(r'((?:RUA|AV|AVENIDA|SETOR|QD|Q\.)[\s\S]*?CEP:\s*\d{5,8}\s+[\w\s,]+?BRASIL)', text, re.IGNORECASE)
    if match:
        # Remove quebras de linha e espaços extras, para no primeiro "BRASIL"
        addr = re.sub(r'\s+', ' ', match.group(1)).strip()
        # Corta tudo após "BRASIL" caso haja lixo colado
        addr = re.sub(r'(BRASIL).*', r'\1', addr)
        return addr
    return None


def extract_uc(text):
    """
    A UC aparece de duas formas:
    - Novo layout: "RAMAL: 0% 500031319" (mesmo linha)
    - Antigo layout: "Consulte pela Chave de Acesso em:\n10038900210"
    """
    # Novo: número na mesma linha que "RAMAL: 0%"
    match = re.search(r'RAMAL:\s*0%\s+(\d{6,12})\b', text)
    if match:
        return match.group(1)
    # Novo alternativo: número na linha seguinte
    match = re.search(r'RAMAL:\s*0%\s*\n\s*(\d{6,12})\b', text)
    if match:
        return match.group(1)
    # Antigo: número na linha após "Consulte pela Chave de Acesso em:"
    match = re.search(r'Consulte pela Chave de Acesso em:\s*\n\s*(\d{6,12})\b', text)
    if match:
        return match.group(1)
    return None


def _to_title_case_month(mes_ref):
    """Converte 'MAR/2026' ou 'mar/2026' para 'Mar/2026' (Title Case)."""
    if not mes_ref or '/' not in mes_ref:
        return mes_ref
    mes, ano = mes_ref.split('/', 1)
    if not mes:
        return mes_ref
    return f"{mes[0].upper()}{mes[1:].lower()}/{ano}"


def extract_reference_month_and_due_date(text):
    """
    Dois formatos possíveis na mesma linha:
    - "MAR/2026 15/04/2026 R$***816,68"  (data antes do valor)
    - "MAR/2026 R$***42,56 16/04/2026"   (data depois do valor)
    Ambos têm mês no formato MMM/YYYY.
    Retorna o mês em Title Case ("Mar/2026") para manter consistência com dados legados.
    """
    # Formato 1: MÊS/ANO  DATA  R$...
    match = re.search(
        r'\b((?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+R\$',
        text
    )
    if match:
        return _to_title_case_month(match.group(1)), match.group(2)

    # Formato 2: MÊS/ANO  R$...  DATA
    match = re.search(
        r'\b((?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/\d{4})\s+R\$.*?(\d{2}/\d{2}/\d{4})',
        text
    )
    if match:
        return _to_title_case_month(match.group(1)), match.group(2)

    # Fallback antigo: após CFOP
    match = re.search(r'CFOP \d{4}:.*?\n(\w{3}/\d{4})\s+(\d{2}/\d{2}/\d{4})', text)
    if match:
        return _to_title_case_month(match.group(1)), match.group(2)

    return None, None


def extract_reading_info(text):
    """
    Linha de leituras: "26/02/2026 28/03/2026 30 28/04/2026"
    Três ou quatro datas/números na mesma linha após "Tensão Nominal Disp".
    """
    # Busca linha com padrão: data data número [data_opcional]
    match = re.search(r'(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+(\d{1,3})\b', text)
    if match:
        return match.group(1), match.group(2), match.group(3)
    return None, None, None


def sanitize_to_float(value):
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            clean_value = re.sub(r'[^\d.,-]', '', value)
            if not clean_value:
                return 0.0
            if '.' in clean_value and ',' in clean_value:
                last_point = clean_value.rfind('.')
                last_comma = clean_value.rfind(',')
                if last_point > last_comma:
                    return float(clean_value.replace(',', ''))
                else:
                    return float(clean_value.replace('.', '').replace(',', '.'))
            elif ',' in clean_value:
                return float(clean_value.replace('.', '').replace(',', '.'))
            elif '.' in clean_value:
                if clean_value.count('.') > 1:
                    return float(clean_value.replace('.', ''))
                parts = clean_value.split('.')
                if len(parts[-1]) == 3 and len(parts) > 1:
                    return float(clean_value.replace('.', ''))
                return float(clean_value)
            return float(clean_value)
        except ValueError:
            return 0.0
    return 0.0


def format_to_br(value, decimals=2):
    try:
        val = float(value)
        formatted = f"{val:,.{decimals}f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return formatted
    except (ValueError, TypeError):
        return "0," + "0" * decimals


def extract_data_from_text(text, pdf_path):
    data = {
        'pdfPath': pdf_path,
        'extractionErrors': []
    }

    try:
        data['cpfCnpj'] = extract_cpf_cnpj(text)
        if not data['cpfCnpj']:
            data['extractionErrors'].append('CPF/CNPJ')
    except Exception:
        data['cpfCnpj'] = None
        data['extractionErrors'].append('CPF/CNPJ')

    try:
        data['valorTotal'] = extract_valor_total(text)
        if not data['valorTotal']:
            data['extractionErrors'].append('Valor Total')
    except Exception:
        data['valorTotal'] = None
        data['extractionErrors'].append('Valor Total')

    data['saldoKwh'] = extract_balance(text)
    data['nomeCliente'] = extract_client_name(text)
    data['endereco'] = extract_address(text)
    data['unidadeConsumidora'] = extract_uc(text)

    mes, venc = extract_reference_month_and_due_date(text)
    data['mesReferencia'] = mes
    data['dataVencimento'] = venc

    leit_ant, leit_atu, qtd_dias = extract_reading_info(text)
    data['leituraAnterior'] = leit_ant
    data['leituraAtual'] = leit_atu
    data['quantidadeDias'] = qtd_dias

    try:
        data['contribuicaoIluminacao'] = extract_contribuicao(text)
    except Exception:
        data['contribuicaoIluminacao'] = "0"
        data['extractionErrors'].append('Contribuição Iluminação')

    try:
        consumo_scee, preco_compensada = extract_consumo_scee(text)
        data['consumoScee'] = consumo_scee
        data['precoEnergiaCompensada'] = preco_compensada
        if not consumo_scee:
            data['extractionErrors'].append('Consumo SCEE')
    except Exception:
        data['consumoScee'] = None
        data['precoEnergiaCompensada'] = None

    # consumoKwh — linha do medidor
    try:
        match = re.search(r'ENERGIA ATIVA - KWH.*?(\d+)\s+(\d+)\s+([\d\.,]+)\s+(\d+)', text)
        data['consumoKwh'] = match.group(4) if match else data.get('consumoScee')
    except Exception:
        data['consumoKwh'] = None
        data['extractionErrors'].append('Consumo kWh')

    try:
        energia_inj, preco_inj = extract_injecao_scee(text)
        data['energiaInjetada'] = energia_inj
        data['precoEnergiaInjetada'] = preco_inj
    except Exception:
        data['energiaInjetada'] = None
        data['precoEnergiaInjetada'] = None

    try:
        consumo_nc, preco_nc = extract_consumo_nao_compensado(text)
        data['consumoNaoCompensado'] = consumo_nc
        data['precoKwhNaoCompensado'] = preco_nc
    except Exception:
        data['consumoNaoCompensado'] = "0"
        data['precoKwhNaoCompensado'] = "0"

    try:
        data['precoFioB'] = extract_fio_b(text)
    except Exception:
        data['precoFioB'] = None

    try:
        data['precoAdcBandeira'] = extract_adc_bandeira(text)
    except Exception:
        data['precoAdcBandeira'] = "0"

    try:
        ciclo, uc_geradora, geracao = extract_ciclo_geracao(text)
        data['cicloGeracao'] = ciclo
        data['ucGeradora'] = uc_geradora
        data['geracaoUltimoCiclo'] = geracao
    except Exception:
        data['cicloGeracao'] = None
        data['ucGeradora'] = None
        data['geracaoUltimoCiclo'] = None

    return data


def calculate_values(data, price_kwh, discount_percent):
    try:
        consumo_scee = sanitize_to_float(data.get('consumoScee', '0'))
        preco_fio_b = sanitize_to_float(data.get('precoFioB', '0'))
        valor_total = sanitize_to_float(data.get('valorTotal', '0'))

        fio_b_valor = consumo_scee * preco_fio_b
        data['fioB'] = round(fio_b_valor, 2)

        valor_sem_desconto = (consumo_scee * price_kwh) + valor_total - fio_b_valor
        data['valorSemDesconto'] = round(valor_sem_desconto, 2)

        discount_multiplier = 1 - (discount_percent / 100)
        valor_com_desconto = ((consumo_scee * price_kwh) * discount_multiplier) + valor_total - fio_b_valor
        data['valorComDesconto'] = round(valor_com_desconto, 2)

        data['economia'] = round(valor_sem_desconto - valor_com_desconto, 2)
        data['lucro'] = round(valor_com_desconto - valor_total, 2)

    except Exception as e:
        data['calculationError'] = str(e)

    return data


def main():
    parser = argparse.ArgumentParser(description='Extrai dados de faturas de energia em PDF')
    parser.add_argument('pdf_path', help='Caminho do arquivo PDF')
    parser.add_argument('--price-kwh', type=float, default=0.85, help='Preço do kWh')
    parser.add_argument('--discount', type=float, default=25.0, help='Desconto percentual')
    args = parser.parse_args()

    text, error = extract_text_from_pdf(args.pdf_path)
    if error:
        print(json.dumps({'success': False, 'error': f'Erro ao ler PDF: {error}'}))
        sys.exit(1)
    if not text:
        print(json.dumps({'success': False, 'error': 'Não foi possível extrair texto do PDF'}))
        sys.exit(1)

    data = extract_data_from_text(text, args.pdf_path)
    data = calculate_values(data, args.price_kwh, args.discount)

    price_fields = ['precoFioB', 'precoAdcBandeira', 'precoKwhNaoCompensado',
                    'precoEnergiaInjetada', 'precoEnergiaCompensada']
    monetary_fields = ['valorTotal', 'contribuicaoIluminacao', 'fioB',
                       'valorSemDesconto', 'valorComDesconto', 'economia', 'lucro']
    quantity_fields = ['consumoKwh', 'saldoKwh', 'energiaInjetada', 'consumoScee',
                       'consumoNaoCompensado', 'geracaoUltimoCiclo']

    for field in price_fields:
        if field in data and data[field] is not None:
            data[field] = format_to_br(sanitize_to_float(data[field]), decimals=6)

    for field in monetary_fields + quantity_fields:
        if field in data and data[field] is not None:
            data[field] = format_to_br(sanitize_to_float(data[field]), decimals=2)

    data['success'] = True
    data['precoKwhUsado'] = format_to_br(args.price_kwh, decimals=6)
    data['descontoUsado'] = args.discount

    print(json.dumps(data, ensure_ascii=False))


if __name__ == "__main__":
    main()
