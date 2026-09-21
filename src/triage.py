"""Triage a support ticket with one System One request.

Demonstrates the three primitives answering independent questions over the
same state. They run in parallel in a single round trip and cannot see one
another's answers, so each must stand on its own.
"""

import os
import sys

from typesafe_sdk import (
    Choice,
    Noul,
    Score,
    TypeSafeAPIConnectionError,
    TypeSafeAuthenticationError,
    TypeSafeClient,
    TypeSafeError,
)

# Stand-in for whatever your app actually loads. Named fields beat one blob:
# questions can reference paths like `ticket.messages[0].text`.
TICKET = {
    "ticket": {
        "subject": "Charged twice for the annual plan",
        "messages": [
            {
                "author": "customer",
                "text": (
                    "I upgraded to annual yesterday and my card shows two "
                    "charges of $480. I need one refunded. This is the second "
                    "billing problem this year and I'm losing patience."
                ),
            }
        ],
        "plan": "annual",
        "account_age_days": 412,
    }
}

QUESTIONS = {
    "category": Choice(
        instructions="Which team should own this ticket?",
        criteria={
            "billing": "Charges, refunds, invoices, or payment methods.",
            "technical": "The product is broken, erroring, or behaving wrongly.",
            "account": "Login, permissions, or account settings.",
            "other": "None of the above fit.",
        },
    ),
    "is_churn_risk": Noul(
        instructions=(
            "Does the customer show signs they may cancel? Consider stated "
            "frustration, references to repeated problems, and loss of patience "
            "— not merely that they have a complaint."
        ),
    ),
    "urgency": Score(
        instructions="How urgently does this need a human response?",
        criteria=[
            "Purely informational; no response needed this week.",
            "A routine request; answering within a few days is fine.",
            "The customer is blocked or out of pocket; answer within a day.",
            "Money is actively wrong or access is lost; answer within hours.",
        ],
    ),
}


def main() -> int:
    try:
        client = TypeSafeClient()
    except TypeSafeError as exc:
        print(f"Could not build client: {exc}", file=sys.stderr)
        print(
            "Set TYPESAFE_API_KEY in your environment or .env file.",
            file=sys.stderr,
        )
        return 1

    try:
        response = client.system_one(state=TICKET, questions=QUESTIONS)
    except TypeSafeAuthenticationError:
        print("The API key was rejected. Check it is current.", file=sys.stderr)
        return 1
    except TypeSafeAPIConnectionError as exc:
        print(f"Could not reach the API: {exc}", file=sys.stderr)
        print(
            "If you are in a sandbox, api.typesafe.ai may be blocked by the "
            "network egress policy.",
            file=sys.stderr,
        )
        return 1
    finally:
        client.close()

    category = response.answers["category"]
    churn = response.answers["is_churn_risk"]
    urgency = response.answers["urgency"]

    print(f"model: {response.model}\n")
    print(f"route to:    {category.choice}  (confidence {category.confidence:.2f})")
    print(f"churn risk:  {churn.noul:.2f}")
    print(f"urgency:     {urgency.score:.2f}  (confidence {urgency.confidence:.2f})")

    # Policy lives in code, not in the model. Thresholds are placeholders —
    # tune them against your own data and the cost of being wrong.
    if churn.noul > 0.7 and urgency.score > 2.5:
        print("\n-> escalate: retention-sensitive and time-critical")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
