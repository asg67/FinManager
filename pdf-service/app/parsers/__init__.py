from .sber import parse_sber
from .tbank import parse_tbank
from .tbank_deposit import parse_tbank_deposit

PARSERS = {
    "sber": parse_sber,
    "tbank": parse_tbank,
    "tbank_deposit": parse_tbank_deposit,
}
