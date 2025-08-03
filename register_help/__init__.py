import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        "To register, visit the signup page and complete the 3-step login:\n"
        "1. Email + Password\n"
        "2. Security Question\n"
        "3. Caesar Cipher challenge",
        mimetype="text/plain"
    )
