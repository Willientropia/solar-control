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

def generate_cliente_relatorio(data, output_path):
    template = env.get_template('relatorio_cliente.html')
    css_path = os.path.join(template_dir, 'styles.css')
    logo_path = os.path.join(template_dir, 'logo.png')

    logo_base64 = logo_to_base64(logo_path)

    economia_total = float(data.get('economiaTotal', 0) or 0)
    valor_sem_desconto_total = float(data.get('valorSemDescontoTotal', 0) or 0)
    valor_com_desconto_total = float(data.get('valorComDescontoTotal', 0) or 0)
    desconto_percentual = float(data.get('descontoPercentual', 0) or 0)

    # Process faturas list
    faturas_list = []
    for fatura in data.get('faturas', []):
        faturas_list.append({
            'mes': fatura.get('mes', ''),
            'consumo_scee': format_number(fatura.get('consumoScee', 0)),
            'valor_sem_desconto': format_currency(fatura.get('valorSemDesconto', 0)),
            'valor_com_desconto': format_currency(fatura.get('valorComDesconto', 0)),
            'economia': format_currency(fatura.get('economia', 0)),
        })

    template_data = {
        'logo_base64': logo_base64,
        'nome_cliente': data.get('nomeCliente', ''),
        'endereco_completo': data.get('enderecoCompleto', ''),
        'unidade_consumidora': data.get('unidadeConsumidora', ''),
        'periodo': data.get('periodo', ''),
        'desconto_percentual': format_number(desconto_percentual),
        'economia_total': format_currency(economia_total),
        'valor_sem_desconto_total': format_currency(valor_sem_desconto_total),
        'valor_com_desconto_total': format_currency(valor_com_desconto_total),
        'faturas': faturas_list,
        'num_meses': len(faturas_list),
    }

    html_content = template.render(template_data)

    HTML(string=html_content).write_pdf(
        output_path,
        stylesheets=[CSS(css_path)]
    )

    return output_path

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: generate_cliente_relatorio.py <json_data> <output_path>"}))
        sys.exit(1)

    try:
        data = json.loads(sys.argv[1])
        output_path = sys.argv[2]
        result = generate_cliente_relatorio(data, output_path)
        print(json.dumps({"success": True, "path": result}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
