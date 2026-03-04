import csv

out_lines = []
with open("questions.csv", encoding="utf-8") as f:
    reader = csv.reader(f)
    header = next(reader)
    for i, row in enumerate(reader):
        if len(row) < 9: continue
        q_id, level, category, q_text, correct, d1, d2, d3, d4 = row[:9]
        if category in ["四字熟語", "慣用句", "ことわざ"]:
            c_len = len(correct)
            max_d = max(len(d1), len(d2), len(d3), len(d4))
            if c_len > max_d + 4: # correct is more than 4 chars longer than the longest dummy
                out_lines.append(f"ID {q_id}: {category} - C: {correct}({c_len}) vs maxD: {max_d}")

print(f"Total: {len(out_lines)}")
for line in out_lines:
    print(line)
