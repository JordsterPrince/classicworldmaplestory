import json
import boto3
import os

ses = boto3.client("ses", region_name="us-east-1")

FROM_EMAIL = "Classic World MapleStory <contact@classicworldmaplestory.com>"
TO_EMAIL = "classicworldmaplestory@gmail.com"

def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))

        # Honeypot spam check
        if body.get("website"):
            return response(200, "ok")

        message_type = body.get("type", "Message")
        message = body.get("message", "(no message)")
        reply = body.get("reply")

        reply_to = None
        reply_info = ""
        if reply:
            if "@" in reply:
                reply_to = reply
                reply_info = f"Reply-to: {reply}\n"
            else:
                reply_info = f"Discord: {reply}\n"

        email_params = {
            "Source": FROM_EMAIL,
            "Destination": {
                "ToAddresses": [TO_EMAIL]
            },
            "Message": {
                "Subject": {
                    "Data": f"[Contact] {message_type}",
                    "Charset": "UTF-8"
                },
                "Body": {
                    "Text": {
                        "Data": (
                            f"Message type: {message_type}\n\n"
                            f"Message:\n{message}\n\n"
                            f"{reply_info}"
                            "---\nSent from contact form"
                        ),
                        "Charset": "UTF-8"
                    }
                }
            }
        }

        if reply_to:
            email_params["ReplyToAddresses"] = [reply_to]

        ses.send_email(**email_params)

        return response(200, {"success": True})

    except Exception as e:
        print("Error:", str(e))
        return response(500, {"error": "Failed to send email"})

def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }
