import tkinter as tk
from tkinter import filedialog, simpledialog
import pdfplumber
import pytesseract
from PIL import Image
import re
import pandas as pd
import json


# Configure o caminho do Tesseract OCR, caso necessário
pytesseract.pytesseract_cmd = r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
# Declaração das variáveis globais
price_kwh = None
discount = None
global_max_price_kwh = None

def extract_text_from_pdf(pdf_path):
    """Extrai texto do PDF, utilizando OCR se necessário."""
    text = ''
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text
            else:
                image = page.to_image(resolution=300).original
                ocr_text = pytesseract.image_to_string(image, lang='por')
                text += ocr_text           
    return text

def get_user_input():
    """Solicita as variáveis 'Preço do KWh no Mercado Cativo' e 'Desconto' apenas uma vez."""
    global price_kwh, discount, global_max_price_kwh

    if price_kwh is None or discount is None:
        root = tk.Tk()
        root.withdraw()  # Esconde a janela principal

        # Preenche o input com o maior valor extraído (se houver)
        max_price_suggestion = f"(Maior valor extraído: R$ {global_max_price_kwh:.2f})" if global_max_price_kwh else "(Nenhum valor extraído)"
        price_kwh = simpledialog.askfloat(
            "Preço do KWh",
            f"Digite o preço do KWh no mercado cativo (R$): {max_price_suggestion}",
            minvalue=0,
            initialvalue=global_max_price_kwh if global_max_price_kwh else 0  # Sugestão no campo
        )

        discount = simpledialog.askfloat(
            "Desconto",
            "Digite o desconto (%) que será aplicado:",
            minvalue=0,
            maxvalue=100
        )

        if price_kwh is None or discount is None:
            print("Preço do KWh ou Desconto não definidos. Cancelando execução.")
            exit()

    return price_kwh, discount






def calculate_without_discount(consumption_scee, non_compensated, price_kwh, contribution, adc_bandeira_price, fio_b_price):
    """Calcula o valor total caso a pessoa não tivesse o desconto."""
    try:
        scee_value = sanitize_to_float(consumption_scee)
        non_compensated_value = sanitize_to_float(non_compensated)
        contribution_value = sanitize_to_float(contribution)
        adc_bandeira_value = sanitize_to_float(adc_bandeira_price)
        fio_b_value = sanitize_to_float(fio_b_price)

        # Inclui o cálculo com Preço do Fio B
        total = ((scee_value + non_compensated_value) * price_kwh) + contribution_value #+ \
                #(non_compensated_value * adc_bandeira_value) #+ (scee_value * fio_b_value)
        return round(total, 2)
    except ValueError as e:
        print(f"Erro ao calcular o valor Sem a Solar: {e}")
        return None


def calculate_with_discount(consumption_scee, non_compensated, price_kwh, discount_percent, contribution, adc_bandeira_price, fio_b_price):
    """Calcula o valor total considerando o desconto."""
    try:
        scee_value = sanitize_to_float(consumption_scee)
        non_compensated_value = sanitize_to_float(non_compensated)
        discount_multiplier = 1 - (discount_percent / 100)
        contribution_value = sanitize_to_float(contribution)
        adc_bandeira_value = sanitize_to_float(adc_bandeira_price)
        fio_b_value = sanitize_to_float(fio_b_price)

        # Inclui o cálculo com Preço do Fio B
        total = ((scee_value + non_compensated_value) * price_kwh * discount_multiplier) + contribution_value #+ \
                #(non_compensated_value * adc_bandeira_value) #+ (scee_value * fio_b_value)
        return round(total, 2)
    except ValueError as e:
        print(f"Erro ao calcular o valor com desconto: {e}")
        return None






def extract_address(text):
    """Captura o endereço a partir do texto."""
    match = re.search(r'(RUA .*?\n.*?CEP: .*?BRASIL)', text, re.DOTALL)
    return match.group(1).replace("\n", " ") if match else None

def extract_reference_month_and_due_date(text):
    """Captura o mês de referência e a data de vencimento."""
    match = re.search(r'CFOP \d{4}:.*?\n(\w{3}/\d{4})\s+(\d{2}/\d{2}/\d{4})', text)
    if match:
        return {
            'Mês de Referência': match.group(1),
            'Data de Vencimento': match.group(2)
        }
    return {
        'Mês de Referência': None,
        'Data de Vencimento': None
    }

def extract_uc_info(text):
    """Captura a informação da Unidade Consumidora (UC)."""
    try:
        match = re.search(r'Consulte pela Chave de Acesso em:\s*(\d+)', text)
        if match:
            return match.group(1)
        else:
            print("UC não encontrada.")
            return None
    except Exception as e:
        print(f"Erro ao processar UC: {e}")
        return None

def extract_reading_info(text):
    """Captura as informações de leitura anterior, leitura atual e quantidade de dias."""
    try:
        match = re.search(r'(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+(\d+)', text)
        if match:
            return {
                'Leitura Anterior': match.group(1),
                'Leitura Atual': match.group(2),
                'Quantidade de Dias': match.group(3)
            }
        else:
            print("Informações de leitura não encontradas.")
            return {
                'Leitura Anterior': None,
                'Leitura Atual': None,
                'Quantidade de Dias': None
            }
    except Exception as e:
        print(f"Erro ao processar informações de leitura: {e}")
        return {
            'Leitura Anterior': None,
            'Leitura Atual': None,
            'Quantidade de Dias': None
        }

def extract_client_name(text):
    """Captura o nome do cliente a partir do texto."""
    try:
        match = re.search(r'Tensão Nominal Disp: .*?\n(.*?)\n', text)
        if match:
            return match.group(1)
        else:
            print("Nome do cliente não encontrado.")
            return None
    except Exception as e:
        print(f"Erro ao processar o nome do cliente: {e}")
        return None

def extract_balance(text):
    """Captura o saldo de energia (KWH) no texto."""
    match = re.search(r'SALDO KWH:\s*([\d\.,]+)', text)
    if match:
        # Remove vírgulas no final e espaços extras
        return match.group(1).strip().rstrip(',')
    return None


def extract_data_from_text(text, pdf_path):
    """Processa o texto extraído para buscar dados específicos."""
    global global_max_price_kwh  # Permite acesso à variável global

    data = {}

    # Extração de CPF/CNPJ
    try:
        data['CPF/CNPJ'] = re.search(r'CNPJ/CPF: (\d{3}\.\d{3}\.\d{3}-\d{2})', text).group(1)
    except AttributeError:
        data['CPF/CNPJ'] = None
        print("Erro ao extrair CPF/CNPJ")

    # Extração de Consumo (kWh)
    try:
        data['Consumo (kWh)'] = re.search(r'CONSUMO.*?(\d+\,\d+)', text).group(1)
    except AttributeError:
        data['Consumo (kWh)'] = None
        print("Erro ao extrair Consumo (kWh)")

    # Extração de Valor Total
    try:
        data['Valor Total'] = re.search(r'R\$[*]+([\d.,]+)', text).group(1)
    except AttributeError:
        data['Valor Total'] = None
        print("Erro ao extrair Valor Total")

    # Extração do Saldo de Energia
    data['Saldo (kWh)'] = extract_balance(text)

    # Extração do Nome do Cliente
    data['Nome do Cliente'] = extract_client_name(text)

    # Extração do Endereço
    data['Endereço'] = extract_address(text)

    # Extração da Unidade Consumidora
    data['Unidade Consumidora'] = extract_uc_info(text)
    if not data['Unidade Consumidora']:
        print("Erro ao extrair Unidade Consumidora")

    # Extração de Informações de Leitura
    reading_info = extract_reading_info(text)
    data.update(reading_info)

    # Extração do Mês de Referência e Data de Vencimento
    ref_due_info = extract_reference_month_and_due_date(text)
    data.update(ref_due_info)

    # Extração da Contribuição de Iluminação Pública
    try:
        ilum_publica_match = re.search(r'CONTRIB\.\s+ILUM\.\s+PÚBLICA\s+-\s+MUNICIPAL\s+(\d{1,3}(?:\.\d{3})*,\d{2})', text)
        if ilum_publica_match:
            data['Contribuição de Iluminação Pública'] = ilum_publica_match.group(1)
        else:
            data['Contribuição de Iluminação Pública'] = "0"
            print("Contribuição de Iluminação Pública não encontrada.")
    except Exception as e:
        data['Contribuição de Iluminação Pública'] = "0"
        print(f"Erro ao extrair Contribuição de Iluminação Pública: {e}")

    # Extração de Injeção SCEE
    try:
        injection_match = re.search(r'INJEÇÃO SCEE.*?\s(\d+\,\d+).*?\s(\d+\,\d+)', text)
        if injection_match:
            data['Energia Injetada'] = injection_match.group(1)
            data['Preço da Energia Injetada'] = injection_match.group(2)
        else:
            data['Energia Injetada'] = None
            data['Preço da Energia Injetada'] = None
            print("Erro ao extrair Energia Injetada ou Preço da Energia Injetada")
    except AttributeError:
        data['Energia Injetada'] = None
        data['Preço da Energia Injetada'] = None
        print("Erro ao extrair Energia Injetada ou Preço da Energia Injetada")

    # Extração de Consumo SCEE
    try:
        consumption_match = re.search(r'CONSUMO SCEE.*?\s(\d+\,\d+).*?\s(\d+\,\d+)', text)
        if consumption_match:
            data['Consumo SCEE'] = consumption_match.group(1)
            data['Preço da Energia Compensada'] = consumption_match.group(2)
        else:
            data['Consumo SCEE'] = None
            data['Preço da Energia Compensada'] = None
            print("Erro ao extrair Consumo SCEE ou Preço da Energia Compensada")
    except AttributeError:
        data['Consumo SCEE'] = None
        data['Preço da Energia Compensada'] = None
        print("Erro ao extrair Consumo SCEE ou Preço da Energia Compensada")

    # Extração de Preço do Fio B
    try:
        fio_b_match = re.search(r'PARC INJET S/DESC.*?\d+\,\d+.*?\d+\,\d+.*?\s(\d+\,\d+)', text)
        if fio_b_match:
            data['Preço do Fio B'] = fio_b_match.group(1)
        else:
            data['Preço do Fio B'] = None
            print("Erro ao extrair Preço do Fio B")
    except AttributeError:
        data['Preço do Fio B'] = None
        print("Erro ao extrair Preço do Fio B")

    # Extração de Consumo Não Compensado e Preço do kWh Não Compensado
    try:
        nao_compensado_match = re.search(r'CONSUMO NÃO COMPENSADO.*?(\d+\,\d+)', text)
        if nao_compensado_match:
            data['Consumo Não Compensado'] = nao_compensado_match.group(1)
            preco_kwh_match = re.search(r'CONSUMO NÃO COMPENSADO.*?\d+\,\d+.*?\s(\d+\,\d+)', text)
            if preco_kwh_match:
                data['Preço do kWh Não Compensado'] = preco_kwh_match.group(1)
                # Atualizar o maior valor global
                extracted_value = float(preco_kwh_match.group(1).replace(',', '.'))
                if global_max_price_kwh is None or extracted_value > global_max_price_kwh:
                    global_max_price_kwh = extracted_value
            else:
                data['Preço do kWh Não Compensado'] = None
                print("Erro ao extrair Preço do kWh Não Compensado")
        else:
            data['Consumo Não Compensado'] = "0"
            data['Preço do kWh Não Compensado'] = "0"
    except AttributeError:
        data['Consumo Não Compensado'] = "0"
        data['Preço do kWh Não Compensado'] = "0"

    # Extração de Preço do ADC Bandeira
    try:
        adc_bandeira_match = re.search(r'ADC BANDEIRA.*?\d+\,\d+.*?\s(\d+\,\d+)', text)
        if adc_bandeira_match:
            data['Preço do ADC Bandeira'] = adc_bandeira_match.group(1)
        else:
            data['Preço do ADC Bandeira'] = "0"
            print("Erro ao extrair Preço do ADC Bandeira")
    except AttributeError:
        data['Preço do ADC Bandeira'] = "0"
        print("Erro ao extrair Preço do ADC Bandeira")

    # Extração de Geração do Ciclo
    try:
        match_generation = re.search(r'GERAÇÃO CICLO \((\d{2}/\d{4})\) KWH: UC (\d+) : ([\d\.\,]+)', text)
        if match_generation:
            data['Ciclo de Geração'] = match_generation.group(1)
            data['UC Geradora'] = match_generation.group(2)
            # Remove vírgulas finais e espaços desnecessários
            data['Geração do Último Ciclo'] = match_generation.group(3).strip().rstrip(',')
        else:
            data['Ciclo de Geração'] = None
            data['UC Geradora'] = None
            data['Geração do Último Ciclo'] = None
            print("Erro ao extrair dados de geração do ciclo")
    except AttributeError:
        data['Ciclo de Geração'] = None
        data['UC Geradora'] = None
        data['Geração do Último Ciclo'] = None
        print("Erro ao extrair dados de geração do ciclo")


    return data

def sanitize_to_float(value):
    """Converte um valor para float, lidando com strings formatadas ou valores já float."""
    if isinstance(value, str):
        return float(value.replace('.', '').replace(',', '.'))
    elif isinstance(value, (int, float)):
        return float(value)
    return 0.0  # Valor padrão se for None ou inválido

def perform_calculations(data_list, price_kwh, discount):
    for data in data_list:
        try:
            if (
                data.get('Consumo SCEE') and
                data.get('Consumo Não Compensado') and
                data.get('Contribuição de Iluminação Pública') and
                data.get('Preço do ADC Bandeira') and
                data.get('Preço do Fio B')
            ):
                consumption_scee = sanitize_to_float(data['Consumo SCEE'])
                non_compensated = sanitize_to_float(data['Consumo Não Compensado'])
                contribution = sanitize_to_float(data['Contribuição de Iluminação Pública'])
                adc_bandeira_price = sanitize_to_float(data['Preço do ADC Bandeira'])
                fio_b_price = sanitize_to_float(data['Preço do Fio B'])

                # Calcula 'Sem a Solar'
                data['Sem a Solar'] = calculate_without_discount(
                    consumption_scee,
                    non_compensated,
                    price_kwh,
                    contribution,
                    adc_bandeira_price,
                    fio_b_price
                )

                # Calcula 'Com Desconto'
                data['Com desconto'] = calculate_with_discount(
                    consumption_scee,
                    non_compensated,
                    price_kwh,
                    discount,
                    contribution,
                    adc_bandeira_price,
                    fio_b_price
                )

                # Calcula o Desconto em R$
                data['Desconto em R$'] = round(data['Sem a Solar'] - data['Com desconto'], 2)
        except Exception as e:
            print(f"Erro ao realizar cálculos para uma fatura: {e}")

    return data_list

def save_data_to_excel(data_list):
    """Salva os dados extraídos em um arquivo Excel."""
    # Converte a lista de dicionários em um DataFrame
    df = pd.DataFrame(data_list)

    # Especifique as colunas que devem ser tratadas como números
    numeric_columns = [
        "Consumo (kWh)", "Valor Total", "Contribuição de Iluminação Pública",
        "Energia Injetada", "Preço da Energia Injetada", "Consumo SCEE", 
        "Preço da Energia Compensada", "Preço do Fio B", "Consumo Não Compensado",
        "Preço do kWh Não Compensado", "Preço do ADC Bandeira", "Quantidade de Dias", "Saldo (kWh)", "Geração do Último Ciclo"
    ]

    # Converte apenas as colunas especificadas para números, se elas existirem no DataFrame
    for col in numeric_columns:
        if col in df.columns:
            try:
                # Remove vírgulas e converte para float
                df[col] = pd.to_numeric(df[col].astype(str).str.replace('.', '').str.replace(',', '.'), errors='coerce')
            except Exception as e:
                print(f"Erro ao converter a coluna '{col}' para numérica: {e}")

    # Solicita o local para salvar o arquivo
    excel_path = filedialog.asksaveasfilename(
        title="Salvar como",
        defaultextension=".xlsx",
        filetypes=[("Arquivo Excel", "*.xlsx")]
    )
    
    if excel_path:
        # Salva o DataFrame no arquivo Excel
        df.to_excel(excel_path, index=False)
        print(f"Dados salvos em: {excel_path}")
    else:
        print("Salvamento cancelado.")


def debug_message(message):
    """Exibe mensagens de depuração se necessário."""
    print(message)

def select_pdfs_and_extract():
    """Abre o explorador de arquivos, seleciona múltiplos PDFs e extrai dados."""
    global global_max_price_kwh  # Permite atualizar o maior valor globalmente

    root = tk.Tk()
    root.withdraw()

    pdf_paths = filedialog.askopenfilenames(
        title="Selecione arquivos PDF",
        filetypes=[("Arquivos PDF", "*.pdf")]
    )

    if pdf_paths:
        all_data = []
        for pdf_path in pdf_paths:
            pdf_text = extract_text_from_pdf(pdf_path)
            debug_message(f"Texto extraído do PDF ({pdf_path}):")
            extracted_data = extract_data_from_text(pdf_text, pdf_path)
            all_data.append(extracted_data)

        # Solicitar input do preço do KWh e desconto
        price_kwh, discount = get_user_input()

        # Realizar os cálculos 'Sem a Solar' e 'Com Desconto'
        all_data = perform_calculations(all_data, price_kwh, discount)

        # Salvar os dados em um arquivo Excel
        save_data_to_excel(all_data)
    else:
        print("Nenhum arquivo selecionado.")


if __name__ == "__main__":
    select_pdfs_and_extract()
    # Salvar preço do KWh e desconto no arquivo JSON
    with open('price_kwh.json', 'w') as f:
        json.dump({'price_kwh': price_kwh, 'discount': discount}, f)
