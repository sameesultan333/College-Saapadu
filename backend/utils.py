from datetime import timezone, timedelta


IST = timezone(timedelta(hours=5, minutes=30))


def to_ist(dt):

    if dt is None:

        return None

    return dt.replace(tzinfo=timezone.utc).astimezone(IST)
