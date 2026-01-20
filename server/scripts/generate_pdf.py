#!/usr/bin/env python3
import sys
import json
import os
import base64
import locale

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS

try:
    locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
except:
    locale.setlocale(locale.LC_ALL, '')

template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
env = Environment(loader=FileSystemLoader(template_dir))

def logo_to_base64(file_path):
    with open(file_path, "rb") as image_file:
        return f"data:image/png;base64,{base64.b64encode(image_file.read()).decode()}"

def format_currency(value):
    try:
        num = float(value) if value else 0.0
        return f"{num:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return "0,00"

def format_number(value):
    try:
        num = float(value) if value else 0.0
        return f"{num:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return "0,00"

def generate_invoice_pdf(data, output_path):
    template = env.get_template('fatura.html')
    css_path = os.path.join(template_dir, 'styles.css')
    logo_path = os.path.join(template_dir, 'logo.png')
    
    logo_base64 = logo_to_base64(logo_path)
    
    consumo_scee = float(data.get('consumoScee', 0) or 0)
    consumo_nao_compensado = float(data.get('consumoNaoCompensado', 0) or 0)
    valor_total = float(data.get('valorTotal', 0) or 0)
    valor_com_desconto = float(data.get('valorComDesconto', 0) or 0)
    valor_sem_desconto = float(data.get('valorSemDesconto', 0) or 0)
    economia = float(data.get('economia', 0) or 0)
    contribuicao_iluminacao = float(data.get('contribuicaoIluminacao', 0) or 0)
    preco_kwh = float(data.get('precoKwh', 0.85) or 0.85)
    preco_fio_b = float(data.get('precoFioB', 0) or 0)

    energia_ativa_quantidade = consumo_scee + consumo_nao_compensado
    energia_ativa_valor = energia_ativa_quantidade * preco_kwh
    # Taxa Mínima = Valor total - ((Consumo não compensado * preço do kwh) + (consumoSCEE * preço do fio B))
    # Onde FIOB = consumoSCEE * preço do fio B
    fio_b_valor = consumo_scee * preco_fio_b
    taxa_minima = valor_total - ((consumo_nao_compensado * preco_kwh) + fio_b_valor)
    valor_calculado = energia_ativa_valor + taxa_minima
    
    tem_desconto = economia > 0
    
    template_data = {
        'logo_base64': logo_base64,
        'nome_cliente': data.get('nomeCliente', ''),
        'endereco_cliente': data.get('enderecoCliente', ''),
        'unidade_consumidora': data.get('unidadeConsumidora', ''),
        'conta_mes': data.get('mesReferencia', ''),
        'vencimento': data.get('dataVencimento', ''),
        'total_a_pagar': format_currency(valor_com_desconto),
        'valor_total': format_currency(valor_sem_desconto),
        'sem_solar': format_currency(valor_sem_desconto),
        'desconto': format_currency(economia),
        'tem_desconto': tem_desconto,
        'energia_ativa_quantidade': format_number(energia_ativa_quantidade),
        'energia_ativa_preco_unitario': format_currency(preco_kwh),
        'energia_ativa_valor': format_currency(energia_ativa_valor),
        'taxa_minima': format_currency(taxa_minima),
    }
    
    html_content = template.render(template_data)
    
    HTML(string=html_content).write_pdf(
        output_path,
        stylesheets=[CSS(css_path)]
    )
    
    return output_path

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: generate_pdf.py <json_data> <output_path>"}))
        sys.exit(1)
    
    try:
        data = json.loads(sys.argv[1])
        output_path = sys.argv[2]
        result = generate_invoice_pdf(data, output_path)
        print(json.dumps({"success": True, "path": result}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
