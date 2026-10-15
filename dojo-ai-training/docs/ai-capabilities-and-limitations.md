# AI capabilities and limitations

This course teaches you how AI is able to work with you. Together they're one system: human competencies on one side and machine properties on the other.

1. Understand Generative AI
Generative AI tạo ra nội dung mới thay vì phân loại nội dung đã có.
AI có những điểm mạnh và điểm yếu tương đối dễ dự đoán trên bốn khía cạnh:
  Dự đoán token tiếp theo (Next Token Prediction),
      + Mạnh: thể tạo văn bản rất tự nhiên, Well-worn paths: summarize, reformat, explain common
      + yếu: Novel territory, sparse patterns, "true vs. sounds true"
  Kiến thức (Knowledge)
      + Mạnh: Làm tốt với kiến thức phổ biến
      + yếu: có thể thiếu kiến thức chuyên biệt hoặc thông tin mới.
  Bộ nhớ làm việc (Working Memory)
      + Mạnh: có thể xử lý nhiều thông tin trong một cuộc hội thoại
      + Yếu: Bị giới hạn và có thể bỏ sót chi tiết
  Khả năng điều hướng (Steerability).
      + mạnh: được điều khiển hơn khi yêu cầu có phạm vi rõ ràng và kết quả có thể kiểm tra được
      + yếu: khó kiểm soát hơn khi nhiệm vụ phức tạp, trừu tượng hoặc đòi hỏi độ chính xác cao

2. How AI gets its character
 + Pretraining produces a document completer by predicting "what comes next" across vast amounts of data. After this stage, it has no concept of helping you.
 + Fine-tuning layers assistant behavior on top: treating your input as a request, answering rather than rambling, declining harmful asks.

3. Next Token Prediction
+ AI dự đoán token tiếp theo dựa trên ngữ cảnh và những gì đã học.
+ Temperature	Điều chỉnh mức độ ngẫu nhiên khi chọn token.
   + Temperature thấp → thường ưu tiên các token có xác suất cao hơn.
   + Temperature cao → kết quả có thể đa dạng hơn.
+ Tail trimming	Loại bỏ những lựa chọn ít có khả năng trước khi chọn token, ví dụ dùng Top-k hoặc Top-p.
    =+ Top-k = 5 → chỉ lấy mẫu trong 5 token có xác suất cao nhất.
     + Top-p = 0.9 → lấy mẫu trong nhóm token có tổng xác suất tích lũy đạt khoảng 90%.

4. What generative AI knows
- comes entirely from training data and is frozen at the knowledge cutoff.
| Mức độ chủ đề | Độ tin cậy dự kiến | Rủi ro |
|---|---|---|
| Phổ biến, có nhiều tài liệu và thông tin nhất quán | Thường cao hơn | Thấp hơn |
| Chuyên biệt, ít tài liệu | Có thể thấp hơn | Cao hơn |
| Thông tin mới sau Knowledge Cutoff | Có thể lỗi thời hoặc không biết | Cao |
| Chủ đề còn tranh cãi, thông tin không thống nhất | Có thể thiên lệch hoặc trả lời sai | Cao |

5. Working Memory
phụ thuộc chủ yếu vào lượng thông tin nằm trong Context Window và mức độ liên quan của thông tin đó với tác vụ hiện tại
Context Degradation
When more context makes things worse
6. When Properties Collide
