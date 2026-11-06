const { GoogleGenAI } = require('@google/genai');

/**
 * Contextual hospitality knowledge base fallback when GEMINI_API_KEY is not set in local environment
 */
function buildSmartHospitalityFallback(userMessage) {
  const q = (userMessage || '').toLowerCase();

  if (q.includes('quán ăn') || q.includes('nhà hàng') || q.includes('q1') || q.includes('quận 1') || q.includes('sài gòn')) {
    return {
      text: `Dạ quanh khu vực Grand Hotel Sài Gòn (Đồng Khởi, Quận 1) có nhiều địa điểm ẩm thực và tham quan nổi tiếng chỉ cách 3–5 phút đi bộ:\n\n• Nhà hàng Ngon (160 Pasteur, Quận 1): Không gian kiến trúc Đông Dương cổ điển, phục vụ ẩm thực 3 miền.\n• Cục Gạch Quán / Bếp Nhà Lục Tỉnh: Ẩm thực truyền thống Nam Bộ chuẩn vị.\n• Phố đi bộ Nguyễn Huệ & Bến Bạch Đằng: Cách khách sạn 200m, lý tưởng để dạo mát buổi tối.`,
      groundingChunks: [
        {
          maps: {
            title: 'Phố đi bộ Nguyễn Huệ - Quận 1, TP.HCM',
            uri: 'https://www.google.com/maps/search/?api=1&query=Pho+di+bo+Nguyen+Hue+Quan+1'
          }
        },
        {
          maps: {
            title: 'Nhà hát Thành phố Hồ Chí Minh (Cách 250m)',
            uri: 'https://www.google.com/maps/search/?api=1&query=Nha+hat+Thanh+pho+Ho+Chi+Minh'
          }
        }
      ]
    };
  }

  if (q.includes('nhận') || q.includes('trả phòng') || q.includes('check-in') || q.includes('check-out') || q.includes('chính sách')) {
    return {
      text: `Dạ chính sách Nhận / Trả phòng tiêu chuẩn trên hệ thống Hotel SaaS như sau ạ:\n\n• Giờ nhận phòng (Check-in): Từ 14:00 hàng ngày (Hỗ trợ nhận mã PIN Smart Lock tự động qua SMS/Email).\n• Giờ trả phòng (Check-out): Trước 12:00 trưa.\n• Nhận phòng sớm / Trả phòng muộn: Phụ thu linh hoạt 30%–50% giá phòng theo quy định từng cơ sở, miễn phí nếu hạng thẻ thành viên VIP còn phòng trống.`,
      groundingChunks: []
    };
  }

  if (q.includes('đà lạt') || q.includes('resort') || q.includes('hồ tuyền lâm')) {
    return {
      text: `Dạ tại Đà Lạt, hệ thống có các khu nghỉ dưỡng rừng thông và view hồ tuyệt đẹp:\n\n• Đà Lạt Pine Resort (Hồ Tuyền Lâm): Biệt thự gỗ thông nguyên căn và phòng Deluxe Double có ban công săn mây, giá chỉ từ 850.000₫/đêm.\n• Boutique Hotel Gần Chợ Đêm Đà Lạt: Thuận tiện đi bộ ra Hồ Xuân Hương và khu ẩm thực đêm Hòa Bình.`,
      groundingChunks: [
        {
          maps: {
            title: 'Khu du lịch Quốc gia Hồ Tuyền Lâm - Đà Lạt',
            uri: 'https://www.google.com/maps/search/?api=1&query=Ho+Tuyen+Lam+Da+Lat'
          }
        },
        {
          maps: {
            title: 'Chợ đêm Đà Lạt & Hồ Xuân Hương',
            uri: 'https://www.google.com/maps/search/?api=1&query=Cho+dem+Da+Lat'
          }
        }
      ]
    };
  }

  if (q.includes('theo giờ') || q.includes('thuê giờ') || q.includes('qua đêm')) {
    return {
      text: `Dạ hệ thống hỗ trợ 3 hình thức đặt phòng linh hoạt:\n\n1. Thuê theo giờ (1h – 6h): Phù hợp nghỉ trưa hoặc công tác ngắn giờ, tính tiền theo khung giờ đầu + giờ cộng thêm.\n2. Thuê qua đêm (Overnight): Nhận phòng từ 21:00–22:00 tối đến 12:00 trưa hôm sau với mức giá tiết kiệm.\n3. Thuê theo ngày (Daily): Nhận phòng 14:00 – trả phòng 12:00 chuẩn khách sạn & resort.`,
      groundingChunks: []
    };
  }

  return {
    text: `Dạ chào Quý khách! Em là Trợ lý AI Concierge của Hotel SaaS. Với câu hỏi "${userMessage}", em sẵn sàng tư vấn hạng phòng trống, báo giá theo ngày/giờ hoặc gợi ý địa điểm ăn uống quanh khách sạn. Quý khách muốn tìm cơ sở tại Sài Gòn (Quận 1), Đà Lạt, Đà Nẵng hay Vũng Tàu ạ?`,
    groundingChunks: []
  };
}

/**
 * Handles /api/ai/chat POST requests from Angular frontend
 * Uses gemini-3.8-flash with Google Maps Grounding when enabled/available
 */
async function handleChat(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const messages = payload.messages || [];
      const userMessage = payload.message || (messages.length > 0 ? messages[messages.length - 1].content : '');
      const userLocation = payload.location;

      if (!userMessage) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Tin nhắn không được để trống.' }));
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const fallback = buildSmartHospitalityFallback(userMessage);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(fallback));
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const systemInstruction = `Bạn là Trợ lý AI Concierge khách sạn & nghỉ dưỡng cao cấp của nền tảng Hotel SaaS.
Nhiệm vụ của bạn:
1. Tư vấn lịch sự, chuyên nghiệp, thân thiện, chuẩn phong cách khách sạn 5 sao cho khách hàng lưu trú và khách du lịch.
2. Hỗ trợ thông tin về các chi nhánh khách sạn: Grand Hotel Sài Gòn (Quận 1), Đà Lạt Pine Resort, Vũng Tàu Beach Hotel, Phú Quốc Emerald Bay.
3. Giải đáp chính sách nhận phòng (14:00), trả phòng (12:00), dịch vụ giặt ủi, bữa sáng buffet, và thủ tục đặt phòng trực tuyến.
4. Khi khách hỏi về địa điểm ăn uống, quán cà phê, danh lam thắng cảnh xung quanh, hãy tận dụng công cụ Google Maps để đưa ra gợi ý chính xác, kèm thông tin hữu ích và địa chỉ.
5. Luôn trả lời bằng Tiếng Việt chỉn chu, có cấu trúc rõ ràng.`;

      const contents = [];
      const recentMessages = messages.slice(-10);
      for (const m of recentMessages) {
        const mappedRole = m.role === 'assistant' ? 'model' : 'user';
        // Gemini API requires the first turn in contents to have role 'user'
        if (contents.length === 0 && mappedRole !== 'user') {
          continue;
        }
        contents.push({
          role: mappedRole,
          parts: [{ text: m.content }]
        });
      }

      if (contents.length === 0 || contents[contents.length - 1].parts[0].text !== userMessage) {
        contents.push({
          role: 'user',
          parts: [{ text: userMessage }]
        });
      }

      const config = {
        systemInstruction,
        tools: [{ googleMaps: {} }]
      };

      if (userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude
            }
          }
        };
      } else {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: 10.7769,
              longitude: 106.7009
            }
          }
        };
      }

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config
        });
      } catch (err) {
        console.warn('Gemini Maps Grounding failed, falling back to standard text:', err?.message || err);
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: { systemInstruction }
        });
      }

      const text = response?.text || buildSmartHospitalityFallback(userMessage).text;
      const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        text,
        groundingChunks
      }));
    } catch (err) {
      console.error('AI chat endpoint error:', err?.message || err);
      let fallbackMsg = '';
      try {
        const parsed = JSON.parse(body || '{}');
        fallbackMsg = parsed.message || '';
      } catch {}
      const fallback = buildSmartHospitalityFallback(fallbackMsg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fallback));
    }
  });
}

module.exports = { handleChat };
