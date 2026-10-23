"""Display region names without exposing IANA reference-city identifiers."""
def timezone_label(value):
 return {'America/Vancouver':'Pacific Time','America/Edmonton':'Mountain Time','America/Regina':'Saskatchewan Time','America/Winnipeg':'Central Time','America/Toronto':'Eastern Time','America/Halifax':'Atlantic Time','America/St_Johns':'Newfoundland Time','America/Whitehorse':'Yukon Time','UTC':'UTC'}.get(value,'Local trial time')
