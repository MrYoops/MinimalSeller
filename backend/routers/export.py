# Excel Export Module
# Exports all analytics data to Excel format

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timedelta
from io import BytesIO
import xlsxwriter

from backend.core.database import get_database
from backend.auth_utils import get_current_user
from backend.business_analytics import get_ozon_credentials, fetch_ozon_operations, categorize_operations
from backend.yandex_analytics import get_yandex_credentials, fetch_yandex_orders, analyze_orders, format_date_for_yandex

router = APIRouter(prefix="/api/export", tags=["export"])


def format_currency(value):
    """Format number as currency string"""
    return f"{value:,.2f} ₽"


@router.get("/economics-excel")
async def export_economics_excel(
    date_from: str = Query(...),
    date_to: str = Query(...),
    marketplace: str = Query("ozon", enum=["ozon", "yandex", "all"]),
    current_user: dict = Depends(get_current_user)
):
    """Export economics report to Excel"""
    seller_id = str(current_user["_id"])
    
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    # Styles
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#1a1a2e',
        'font_color': '#00d4ff',
        'border': 1
    })
    money_format = workbook.add_format({'num_format': '#,##0.00 ₽'})
    percent_format = workbook.add_format({'num_format': '0.0%'})
    date_format = workbook.add_format({'num_format': 'dd.mm.yyyy'})
    
    # OZON Sheet
    if marketplace in ["ozon", "all"]:
        try:
            credentials = await get_ozon_credentials(seller_id)
            period_start = datetime.fromisoformat(f"{date_from}T00:00:00")
            period_end = datetime.fromisoformat(f"{date_to}T23:59:59")
            
            operations = await fetch_ozon_operations(
                credentials["client_id"],
                credentials["api_key"],
                period_start,
                period_end
            )
            
            data = categorize_operations(operations)
            
            # Summary sheet
            ws_summary = workbook.add_worksheet("Ozon - Сводка")
            ws_summary.set_column('A:A', 30)
            ws_summary.set_column('B:B', 20)
            
            ws_summary.write('A1', 'ЭКОНОМИКА БИЗНЕСА - OZON', header_format)
            ws_summary.write('A2', f'Период: {date_from} — {date_to}')
            ws_summary.write('A3', f'Дата выгрузки: {datetime.now().strftime("%d.%m.%Y %H:%M")}')
            
            row = 5
            ws_summary.write(row, 0, 'ПОКАЗАТЕЛЬ', header_format)
            ws_summary.write(row, 1, 'СУММА', header_format)
            
            raw = data["raw_totals"]
            summary_data = [
                ('Доходы (поступления)', raw["positive_sum"]),
                ('Расходы (списания)', abs(raw["negative_sum"])),
                ('ЧИСТАЯ ПРИБЫЛЬ', raw["net_total"]),
                ('Маржа, %', raw["net_total"] / raw["positive_sum"] * 100 if raw["positive_sum"] > 0 else 0),
            ]
            
            for i, (name, value) in enumerate(summary_data):
                ws_summary.write(row + 1 + i, 0, name)
                if 'Маржа' in name:
                    ws_summary.write(row + 1 + i, 1, value / 100, percent_format)
                else:
                    ws_summary.write(row + 1 + i, 1, value, money_format)
            
            # Expense breakdown
            row = 12
            ws_summary.write(row, 0, 'ДЕТАЛИЗАЦИЯ РАСХОДОВ', header_format)
            ws_summary.write(row, 1, 'СУММА', header_format)
            
            expense_labels = {
                'returns': 'Возвраты средств',
                'penalties': 'Штрафы (дефект-рейт)',
                'loyalty_points': 'Баллы и кэшбэк',
                'subscription': 'Подписка Premium',
                'storage': 'Хранение',
                'acquiring': 'Эквайринг',
                'early_payment': 'Ранняя выплата',
                'logistics': 'Логистика',
                'client_compensation': 'Компенсации клиентам',
                'other': 'Прочие расходы'
            }
            
            for i, (key, label) in enumerate(expense_labels.items()):
                value = data["expense"].get(key, 0)
                if value > 0:
                    ws_summary.write(row + 1 + i, 0, label)
                    ws_summary.write(row + 1 + i, 1, value, money_format)
            
            # Transactions sheet
            ws_trans = workbook.add_worksheet("Ozon - Транзакции")
            ws_trans.set_column('A:A', 12)
            ws_trans.set_column('B:B', 45)
            ws_trans.set_column('C:C', 15)
            ws_trans.set_column('D:D', 20)
            
            headers = ['Дата', 'Тип операции', 'Сумма', 'Номер отправления']
            for col, header in enumerate(headers):
                ws_trans.write(0, col, header, header_format)
            
            for row, op in enumerate(operations, start=1):
                op_date = op.get("operation_date", "")
                if op_date:
                    try:
                        dt = datetime.fromisoformat(op_date.replace(" ", "T").replace("Z", ""))
                        ws_trans.write(row, 0, dt, date_format)
                    except:
                        ws_trans.write(row, 0, op_date)
                
                ws_trans.write(row, 1, op.get("operation_type_name", op.get("operation_type", "")))
                ws_trans.write(row, 2, op.get("amount", 0), money_format)
                ws_trans.write(row, 3, op.get("posting", {}).get("posting_number", ""))
        
        except Exception as e:
            ws_error = workbook.add_worksheet("Ozon - Ошибка")
            ws_error.write(0, 0, f"Ошибка загрузки данных Ozon: {str(e)}")
    
    # YANDEX Sheet
    if marketplace in ["yandex", "all"]:
        try:
            credentials = await get_yandex_credentials(seller_id)
            
            orders = await fetch_yandex_orders(
                credentials["api_key"],
                credentials["campaign_id"],
                format_date_for_yandex(date_from),
                format_date_for_yandex(date_to)
            )
            
            analysis = analyze_orders(orders)
            
            # Summary sheet
            ws_ym_summary = workbook.add_worksheet("ЯМаркет - Сводка")
            ws_ym_summary.set_column('A:A', 30)
            ws_ym_summary.set_column('B:B', 20)
            
            ws_ym_summary.write('A1', 'ЭКОНОМИКА БИЗНЕСА - ЯНДЕКС.МАРКЕТ', header_format)
            ws_ym_summary.write('A2', f'Период: {date_from} — {date_to}')
            
            row = 4
            ws_ym_summary.write(row, 0, 'ПОКАЗАТЕЛЬ', header_format)
            ws_ym_summary.write(row, 1, 'ЗНАЧЕНИЕ', header_format)
            
            ym_data = [
                ('Всего заказов', analysis["orders_count"]),
                ('Доставлено', analysis["delivered_count"]),
                ('Отменено', analysis["cancelled_count"]),
                ('Товаров продано', analysis["items_sold"]),
                ('Выручка', analysis["income"]["buyer_total"]),
                ('До скидки', analysis["income"]["before_discount"]),
                ('Субсидии от ЯМ', analysis["income"]["subsidies"]),
            ]
            
            for i, (name, value) in enumerate(ym_data):
                ws_ym_summary.write(row + 1 + i, 0, name)
                if 'Выручка' in name or 'скидки' in name or 'Субсидии' in name:
                    ws_ym_summary.write(row + 1 + i, 1, value, money_format)
                else:
                    ws_ym_summary.write(row + 1 + i, 1, value)
            
            # Orders sheet
            ws_ym_orders = workbook.add_worksheet("ЯМаркет - Заказы")
            ws_ym_orders.set_column('A:A', 12)
            ws_ym_orders.set_column('B:B', 15)
            ws_ym_orders.set_column('C:C', 15)
            ws_ym_orders.set_column('D:D', 15)
            ws_ym_orders.set_column('E:E', 20)
            ws_ym_orders.set_column('F:F', 15)
            
            headers = ['ID заказа', 'Статус', 'Сумма', 'До скидки', 'Регион', 'Субсидии']
            for col, header in enumerate(headers):
                ws_ym_orders.write(0, col, header, header_format)
            
            status_names = {
                'DELIVERED': 'Доставлено',
                'PROCESSING': 'В обработке',
                'PICKUP': 'В пункте выдачи',
                'CANCELLED': 'Отменено'
            }
            
            for row, order in enumerate(orders, start=1):
                ws_ym_orders.write(row, 0, order.get("id", ""))
                ws_ym_orders.write(row, 1, status_names.get(order.get("status"), order.get("status", "")))
                ws_ym_orders.write(row, 2, order.get("buyerTotal", 0), money_format)
                ws_ym_orders.write(row, 3, order.get("buyerTotalBeforeDiscount", 0), money_format)
                ws_ym_orders.write(row, 4, order.get("delivery", {}).get("region", {}).get("name", ""))
                subsidies = sum(s.get("amount", 0) for s in order.get("subsidies", []))
                ws_ym_orders.write(row, 5, subsidies, money_format)
        
        except Exception as e:
            ws_error = workbook.add_worksheet("ЯМаркет - Ошибка")
            ws_error.write(0, 0, f"Ошибка загрузки данных Яндекс.Маркет: {str(e)}")
    
    workbook.close()
    output.seek(0)
    
    filename = f"economics_{date_from}_{date_to}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/transactions-excel")
async def export_transactions_excel(
    date_from: str = Query(...),
    date_to: str = Query(...),
    marketplace: str = Query("ozon"),
    current_user: dict = Depends(get_current_user)
):
    """Export all transactions to Excel"""
    seller_id = str(current_user["_id"])
    
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#005bff',
        'font_color': 'white',
        'border': 1
    })
    money_format = workbook.add_format({'num_format': '#,##0.00 ₽'})
    date_format = workbook.add_format({'num_format': 'dd.mm.yyyy hh:mm'})
    
    if marketplace == "ozon":
        credentials = await get_ozon_credentials(seller_id)
        period_start = datetime.fromisoformat(f"{date_from}T00:00:00")
        period_end = datetime.fromisoformat(f"{date_to}T23:59:59")
        
        operations = await fetch_ozon_operations(
            credentials["client_id"],
            credentials["api_key"],
            period_start,
            period_end
        )
        
        ws = workbook.add_worksheet("Транзакции Ozon")
        ws.set_column('A:A', 18)
        ws.set_column('B:B', 50)
        ws.set_column('C:C', 15)
        ws.set_column('D:D', 20)
        ws.set_column('E:E', 30)
        
        headers = ['Дата', 'Тип операции', 'Сумма', 'Номер отправления', 'Услуги']
        for col, h in enumerate(headers):
            ws.write(0, col, h, header_format)
        
        for row, op in enumerate(operations, start=1):
            op_date = op.get("operation_date", "")
            try:
                dt = datetime.fromisoformat(op_date.replace(" ", "T").replace("Z", ""))
                ws.write(row, 0, dt, date_format)
            except:
                ws.write(row, 0, op_date)
            
            ws.write(row, 1, op.get("operation_type_name", op.get("operation_type", "")))
            ws.write(row, 2, op.get("amount", 0), money_format)
            ws.write(row, 3, op.get("posting", {}).get("posting_number", ""))
            
            services = [s.get("name", "") for s in op.get("services", [])]
            ws.write(row, 4, ", ".join(services[:3]))
    
    workbook.close()
    output.seek(0)
    
    filename = f"transactions_{marketplace}_{date_from}_{date_to}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
