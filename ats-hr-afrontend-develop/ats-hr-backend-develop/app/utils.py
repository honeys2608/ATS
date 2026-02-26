import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import Request

def send_otp_email(to_email, otp, subject):
    # Dummy implementation, replace with real SMTP logic
    print(f"Sending OTP {otp} to {to_email} [{subject}]")
    # You can use SMTP or any email service here
    return True

def get_client_ip():
    # In real FastAPI, use request.client.host
    return "127.0.0.1"

def get_device_info():
    # In real FastAPI, parse User-Agent header
    return "Browser/Device Info"
