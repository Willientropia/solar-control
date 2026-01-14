#!/usr/bin/env python3
import sys
import json
import os
import base64
from datetime import datetime

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS

template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
env = Environment(loader=FileSystemLoader(template_dir))

def logo_to_base64(file_path):
    with open(file_path, "rb") as image_file:
        return f"data:image/png;base64,{base64.b64encode(image_file.read()).decode()}"

def format_currency(value):
    """Format number as Brazilian currency (1.234,56)"""
    try:
        num = float(value) if value else 0
        formatted = f"{num:,.2f}"
        # Swap . and , for Brazilian format
        formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        return formatted
    except:
        return "0,00"

def format_number(value):
    """Format number as Brazilian number (1.234,56)"""
    try:
        num = float(value) if value else 0
        formatted = f"{num:,.2f}"
        # Swap . and , for Brazilian format
        formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        return formatted
    except:
        return "0"

def generate_relatorio_pdf(data, output_path):
    template = env.get_template('relatorio_usina.html')
    logo_path = os.path.join(template_dir, 'logo.png')
    
    logo_base64 = logo_to_base64(logo_path)
    
    clientes_data = []
    total_consumo = 0
    total_valor_com_desconto = 0
    total_equatorial = 0
    total_lucro = 0
    total_saldo_kwh = 0
    
    for cliente in data.get('clientes', []):
        consumo = float(cliente.get('consumo', 0) or 0)
        valor_com_desconto = float(cliente.get('valorComDesconto', 0) or 0)
        valor_equatorial = float(cliente.get('valorTotal', 0) or 0)
        lucro = float(cliente.get('lucro', 0) or 0)
        saldo_kwh = float(cliente.get('saldoKwh', 0) or 0)
        
        total_consumo += consumo
        total_valor_com_desconto += valor_com_desconto
        total_equatorial += valor_equatorial
        total_lucro += lucro
        total_saldo_kwh += saldo_kwh
        
        clientes_data.append({
            'numero_contrato': cliente.get('numeroContrato', '') or '',
            'nome': cliente.get('nome', ''),
            'uc': cliente.get('uc', ''),
            'endereco': cliente.get('endereco', '') or '',
            'porcentagem_envio': format_number(cliente.get('porcentagemEnvioCredito', 0)),
            'consumo': format_number(consumo),
            'valor_com_desconto': format_currency(valor_com_desconto),
            'valor_equatorial': format_currency(valor_equatorial),
            'lucro': format_currency(lucro),
            'saldo_kwh': format_number(saldo_kwh),
        })
    
    kwh_gerado = float(data.get('kwhGerado', 0) or 0)
    kwh_previsto = float(data.get('kwhPrevisto', 1) or 1)
    percentual = (kwh_gerado / kwh_previsto * 100) if kwh_previsto > 0 else 0

    # Get potencia and monthly predicted generation
    potencia_kwp = float(data.get('potenciaKwp', 0) or 0)
    kwh_previsto_mensal = float(data.get('kwhPrevistoMensal', 0) or 0)

    template_data = {
        'logo_base64': logo_base64,
        'nome_usina': data.get('nomeUsina', ''),
        'potencia_kwp': format_number(potencia_kwp) if potencia_kwp > 0 else '-',
        'kwh_previsto_mensal': format_number(kwh_previsto_mensal) if kwh_previsto_mensal > 0 else '-',
        'periodo': data.get('periodo', ''),
        'kwh_gerado': format_number(kwh_gerado),
        'percentual_gerado': format_number(percentual),
        'clientes': clientes_data,
        'total_consumo': format_number(total_consumo),
        'total_valor_com_desconto': format_currency(total_valor_com_desconto),
        'total_equatorial': format_currency(total_equatorial),
        'total_lucro': format_currency(total_lucro),
        'total_saldo_kwh': format_number(total_saldo_kwh),
        'data_emissao': datetime.now().strftime('%d/%m/%Y às %H:%M'),
    }
    
    html_content = template.render(template_data)
    
    HTML(string=html_content).write_pdf(output_path)
    
    return output_path

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: generate_relatorio.py <json_data> <output_path>"}))
        sys.exit(1)
    
    try:
        data = json.loads(sys.argv[1])
        output_path = sys.argv[2]
        result = generate_relatorio_pdf(data, output_path)
        print(json.dumps({"success": True, "path": result}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
