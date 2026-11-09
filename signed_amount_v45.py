"""Parse signed Moka amounts without losing refunds. No change to stored precision."""
from decimal import Decimal, InvalidOperation
import re

def signed_money(value):
    if value is None or value == '':
        return 0.0
    if isinstance(value, bool):
        raise ValueError('Boolean bukan nilai uang')
    if isinstance(value,(int,float,Decimal)):
        number=Decimal(str(value))
    else:
        text=str(value).strip().replace('\u2212','-').replace('\u00a0',' ')
        negative=text.startswith('(') and text.endswith(')')
        if negative:text=text[1:-1].strip()
        text=re.sub(r'^(?:Rp|IDR)\s*','',text,flags=re.I).replace(' ','')
        if not re.fullmatch(r'[+-]?[0-9][0-9.,]*',text):raise ValueError('Nilai uang tidak valid')
        if ',' in text and '.' in text:
            decimal=',' if text.rfind(',')>text.rfind('.') else '.'
            text=text.replace('.' if decimal==',' else ',','').replace(decimal,'.')
        elif ',' in text:
            text=text.replace(',','') if re.fullmatch(r'[+-]?\d{1,3}(,\d{3})+',text) else text.replace(',','.')
        elif text.count('.')>1 or re.fullmatch(r'[+-]?\d{1,3}(\.\d{3})+',text):
            text=text.replace('.','')
        try:number=Decimal(text)
        except InvalidOperation as e:raise ValueError('Nilai uang tidak valid') from e
        if negative:number=-abs(number)
    if not number.is_finite():raise ValueError('Nilai uang harus finite')
    return float(number)
