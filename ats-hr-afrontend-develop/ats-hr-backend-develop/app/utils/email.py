import smtplib
from email.message import EmailMessage
import os

def send_email(to: str, subject: str, body: str):
    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_USER")
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()
    server.login(
        os.getenv("SMTP_USER"),
        os.getenv("SMTP_PASS")
    )
    server.send_message(msg)
    server.quit()
