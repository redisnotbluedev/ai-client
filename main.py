from openai import OpenAI

ai = OpenAI(base_url="https://api.llm7.io/v1", api_key="")
resp = ai.chat.completions.create(
    model="gpt-5-chat",
    messages=[
        {"role": "user", "content": "Hi there"}
    ]
)
print(resp.choices[0].message.content)