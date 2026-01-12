import locale
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
import os
import base64
import pandas as pd
from tkinter import Tk, filedialog, simpledialog, messagebox
import json

# Configurar locale para o formato brasileiro
locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')

# Diretório onde estão os templates
template_dir = os.path.dirname(__file__)
env = Environment(loader=FileSystemLoader(template_dir))

with open('price_kwh.json', 'r') as f:
    data = json.load(f)
    price_kwh = data.get('price_kwh')
    discount = data.get('discount')

def logo_to_base64(file_path):
    """Converte a imagem da logo para Base64."""
    with open(file_path, "rb") as image_file:
        return f"data:image/png;base64,{base64.b64encode(image_file.read()).decode()}"

def selecionar_arquivo_excel():
    """Abre o explorador de arquivos para selecionar o arquivo Excel."""
    root = Tk()
    root.withdraw()
    arquivo = filedialog.askopenfilename(
        title="Selecione o arquivo Excel",
        filetypes=[("Arquivos Excel", "*.xlsx *.xls")]
    )
    return arquivo

def solicitar_data_vencimento():
    """Abre janela para solicitar a data de vencimento."""
    root = Tk()
    root.withdraw()
    
    data = simpledialog.askstring(
        "Data de Vencimento",
        "Digite a data de vencimento para todas as faturas:\n(Formato: DD/MM/AAAA)\n\nDeixe em branco para manter as datas originais.",
        parent=root
    )
    
    root.destroy()
    return data

def ler_dados_excel(arquivo):
    """Lê os dados do Excel e retorna um DataFrame."""
    df = pd.read_excel(arquivo)
    return df

def formatar_valores_brasil(dado):
    """Formata os valores numéricos para o padrão brasileiro, exceto campos que devem ser mantidos como strings."""
    for key, value in dado.items():
        if key == "unidade_consumidora":
            continue
        
        if isinstance(value, (int, float)):
            dado[key] = locale.format_string('%.2f', value, grouping=True)
    return dado

def gerar_fatura(dados):
    """Gera faturas com base nos dados fornecidos."""
    template = env.get_template('index.html')
    css_path = os.path.join(template_dir, 'styles.css')

    logo_path = os.path.join(template_dir, 'logo.png')
    logo_base64 = logo_to_base64(logo_path)

    contador = 0
    total_faturas = len(dados)

    for dado in dados:
        dado['logo_base64'] = logo_base64
        desconto_em_reais = dado.get('desconto', 0)
        dado = formatar_valores_brasil(dado)
        dado['tem_desconto'] = desconto_em_reais > 0

        html_content = template.render(dado)
        pdf_filename = f"Fatura_{dado['unidade_consumidora']}.pdf"
        HTML(string=html_content).write_pdf(
            pdf_filename,
            stylesheets=[CSS(css_path)]
        )
        
        contador += 1
        print(f"[{contador}/{total_faturas}] PDF gerado: {pdf_filename}")

def processar_planilha():
    """Lê os dados de um arquivo Excel e gera faturas para cada linha."""
    arquivo_excel = selecionar_arquivo_excel()
    if not arquivo_excel:
        print("Nenhum arquivo selecionado. Operação cancelada.")
        return

    df = ler_dados_excel(arquivo_excel)
    
    # Guardar o valor original de "total_a_pagar"
    if 'Com desconto' in df.columns:
        df['total_a_pagar_original'] = pd.to_numeric(df['Com desconto'], errors='coerce').fillna(0)

    #print("Colunas encontradas no arquivo:", df.columns)

    df.rename(columns={
        "Nome do Cliente": "nome_cliente",
        "Endereço": "endereco_cliente",
        "Unidade Consumidora": "unidade_consumidora",
        "Mês de Referência": "conta_mes",
        "Data de Vencimento": "vencimento",
        "Com desconto": "total_a_pagar",
        "Consumo SCEE": "consumo_scee",
        "Consumo Não Compensado": "consumo_nao_compensado",
        "Contribuição de Iluminação Pública": "iluminacao_publica_base",
        "Preço do ADC Bandeira": "preco_adc_bandeira",
        "Sem a Solar": "sem_solar",
        "Desconto em R$": "desconto",
        "Preço do Fio B": "Fio_B_Value",
    }, inplace=True)

    if df.empty:
        print("Erro: A planilha está vazia ou não possui dados após o cabeçalho.")
        return

    # Solicitar data de vencimento
    nova_data = solicitar_data_vencimento()
    if nova_data and nova_data.strip():
        print(f"\n📅 Data de vencimento alterada para: {nova_data}")
        df['vencimento'] = nova_data
    else:
        print("\n📅 Mantendo as datas de vencimento originais da planilha")

    # Garantir conversão numérica
    df["consumo_scee"] = pd.to_numeric(df["consumo_scee"], errors='coerce').fillna(0)
    df["consumo_nao_compensado"] = pd.to_numeric(df["consumo_nao_compensado"], errors='coerce').fillna(0)
    df["iluminacao_publica_base"] = pd.to_numeric(df["iluminacao_publica_base"], errors='coerce').fillna(0)
    df["preco_adc_bandeira"] = pd.to_numeric(df["preco_adc_bandeira"], errors='coerce').fillna(0)
    df["Fio_B_Value"] = pd.to_numeric(df["Fio_B_Value"], errors='coerce').fillna(0)
    df["sem_solar"] = pd.to_numeric(df["sem_solar"], errors='coerce').fillna(0)
    df["total_a_pagar"] = pd.to_numeric(df["total_a_pagar"], errors='coerce').fillna(0)

    # Cálculos
    df["energia_ativa_quantidade"] = (df["consumo_scee"] + df["consumo_nao_compensado"]).round(2)
    df["energia_ativa_preco_unitario"] = price_kwh
    df["energia_ativa_valor"] = (df["energia_ativa_quantidade"] * df["energia_ativa_preco_unitario"]).round(2)

    custo_bandeira = (df["preco_adc_bandeira"] * df["consumo_nao_compensado"]).round(2)
    df["taxa_minima"] = (df["iluminacao_publica_base"] + custo_bandeira).round(2)
    df["valor_total"] = (df["energia_ativa_valor"] + df["taxa_minima"]).round(2)

    # Ajustar total_a_pagar somando o custo da bandeira
    if not df["total_a_pagar"].isna().all() and not (df["total_a_pagar"] == 0).all():
        df["total_a_pagar"] = (df["total_a_pagar"] + custo_bandeira).round(2)
        df["desconto"] = (df["sem_solar"] - df["total_a_pagar"]).round(2)
    else:
        df["total_a_pagar"] = df["valor_total"]
        df["desconto"] = 0

    print(f"\n📄 Gerando {len(df)} faturas...")
    
    dados_faturas = df.to_dict(orient='records')
    gerar_fatura(dados_faturas)
    
    print("\n" + "="*80)
    print("✅ PROCESSO CONCLUÍDO!")
    print(f"📄 {len(df)} PDFs gerados na pasta atual")
    print("="*80)


if __name__ == "__main__":
    processar_planilha()