import React, { useState, useEffect, useRef } from "react";
import "./ChatBot.css";

function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState("default");
  const messagesEndRef = useRef(null);

  // To store step-by-step answers
  const [concernStep, setConcernStep] = useState(0);
  const [concernData, setConcernData] = useState({
    what: "",
    when: "",
    scooter: "",
    location: ""
  });

  const options = [
    { label: "Submit Concern", type: "concern" },
    { label: "Give Feedback", type: "feedback" },
    { label: "View Booking Info", type: "booking" },
    { label: "Navigation Help", type: "help" },
  ];

  // Auto scroll
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Welcome message
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ from: "bot", text: "Hello! I'm the DALScooter Assistant. How can I help you today?" }]);
    }
  }, [open, messages.length]);

  // Send user message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { from: "user", text: input.trim() };
    setMessages((msgs) => [...msgs, userMessage]);
    setInput("");

    if (mode === "concern") {
      await handleConcernStep(userMessage.text);
    } else if (mode === "feedback") {
      await handleFeedback(userMessage.text);
    } else if (mode === "booking") {
      await handleBookingInfo(userMessage.text);
    } else if (mode === "help") {
      await handleHelp(userMessage.text);
    } else {
      setMessages((msgs) => [...msgs, { from: "bot", text: "Please choose an option to start." }]);
    }
  };

  // === Concern Submission Flow ===
  const handleConcernStep = async (text) => {
    if (concernStep === 0) {
      setConcernData({ ...concernData, what: text });
      setConcernStep(1);
      setMessages((msgs) => [...msgs, { from: "bot", text: "⏰ When did it occur?" }]);
    } else if (concernStep === 1) {
      setConcernData({ ...concernData, when: text });
      setConcernStep(2);
      setMessages((msgs) => [...msgs, { from: "bot", text: "🛴 Please enter your Scooter ID (or type 'skip')" }]);
    } else if (concernStep === 2) {
      setConcernData({ ...concernData, scooter: text === "skip" ? "" : text });
      setConcernStep(3);
      setMessages((msgs) => [...msgs, { from: "bot", text: "📍 Where did it happen? (or type 'skip')" }]);
    } else if (concernStep === 3) {
      const finalData = { ...concernData, location: text === "skip" ? "" : text };
      await submitConcern(finalData);
      setConcernStep(0);
      setConcernData({ what: "", when: "", scooter: "", location: "" });
      setMode("default");
    }
  };

  // === Feedback Handler ===
  // Replace your existing handleFeedback function in ChatBot.jsx with this:

const handleFeedback = async (text) => {
  setIsLoading(true);
  setMessages((msgs) => [...msgs, { from: "bot", text: "Processing your feedback..." }]);
  
  try {
    // Auto-detect local vs deployed environment
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiUrl = isLocal 
      ? "http://localhost:7071/api/submit_feedback"
      : "https://YOUR_AZURE_FUNCTION_APP.azurewebsites.net/api/submit_feedback"; // Replace with your actual Azure Function App URL
    
    console.log(`Using ${isLocal ? 'local' : 'deployed'} API:`, apiUrl);
    
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: "user42", // You can make this dynamic based on actual user
        message: text
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("API Error Response:", errorText);
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const result = await res.json();
    
    setMessages((msgs) => [
      ...msgs,
      { from: "bot", text: `✅ ${result.message || "Thank you for your feedback! We've stored it successfully."}` }
    ]);
    
    console.log("Feedback submitted successfully:", result);
    
  } catch (err) {
    console.error("Feedback submission error:", err);
    
    // More specific error messages
    let errorMessage = "❌ Error submitting feedback. ";
    if (err.message.includes("Failed to fetch")) {
      errorMessage += "Please make sure your Azure Function is running locally (run 'func start').";
    } else {
      errorMessage += "Please try again later.";
    }
    
    setMessages((msgs) => [
      ...msgs, 
      { from: "bot", text: errorMessage }
    ]);
  } finally {
    setIsLoading(false);
    setMode("default");
  }
};

  // === Booking Info Handler ===
  const handleBookingInfo = async (text) => {
  setIsLoading(true);
  setMessages((msgs) => [...msgs, { from: "bot", text: "Looking up your booking information..." }]);

  try {
    // Detect local vs deployed
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiUrl = isLocal 
      ? `http://localhost:7071/api/get_booking?booking_id=${text}`
      : `https://dalscooter-botfunc.azurewebsites.net/api/get_booking?booking_id=${text}`;

    const res = await fetch(apiUrl, { method: "GET" });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bookingInfo = await res.json();

    setMessages((msgs) => [
      ...msgs,
      {
        from: "bot",
        text:
          `📋 **Your Booking Details:**\n` +
          `Booking ID: ${bookingInfo.booking_id}\n` +
          `Scooter: ${bookingInfo.scooter}\n` +
          `Start Time: ${bookingInfo.start_time}\n` +
          `Location: ${bookingInfo.location}\n` +
          `Status: ${bookingInfo.status}`
      }
    ]);
  } catch (err) {
    console.error("Booking info error:", err);
    setMessages((msgs) => [
      ...msgs,
      { from: "bot", text: "❌ Could not retrieve booking details. Please check your booking ID or try again later." }
    ]);
  } finally {
    setIsLoading(false);
    setMode("default");
  }
};


  // === Help Handler ===
  const handleHelp = async (text) => {
    const helpTopics = {
      "unlock": "🔓 To unlock a scooter: Open the app → Scan QR code → Press unlock button",
      "payment": "💳 Payment: We accept credit cards, debit cards, and PayPal through the app",
      "parking": "🅿️ Parking: Please park in designated areas and avoid blocking walkways",
      "safety": "🦺 Safety: Always wear a helmet, follow traffic rules, and ride in bike lanes when available",
      "support": "📞 Support: Contact us at support@dalscooter.com or call 1-800-SCOOTER"
    };

    const lowerText = text.toLowerCase();
    let response = "❓ **Navigation Help Topics:**\n\n";
    
    for (const [topic, info] of Object.entries(helpTopics)) {
      if (lowerText.includes(topic)) {
        response = `✅ ${info}\n\nNeed help with something else? Just ask!`;
        break;
      }
    }
    
    if (response.includes("Navigation Help Topics")) {
      response += "• Type 'unlock' for scooter unlocking help\n";
      response += "• Type 'payment' for payment information\n";
      response += "• Type 'parking' for parking guidelines\n";
      response += "• Type 'safety' for safety tips\n";
      response += "• Type 'support' for contact information";
    }

    setMessages((msgs) => [...msgs, { from: "bot", text: response }]);
    // Don't reset mode for help - allow multiple questions
  };

  // Submit Concern to AWS API
  // Submit Concern to AWS API
const submitConcern = async (data) => {
  setIsLoading(true);
  setMessages((msgs) => [
    ...msgs,
    { from: "bot", text: "Processing your concern..." }
  ]);

  const finalMessage = `${data.what || "N/A"}. Occurred: ${data.when || "N/A"}. Scooter: ${data.scooter || "N/A"}. Location: ${data.location || "N/A"}`;

  try {
    // Generate a unique concern ID
    const concernId = `C${Date.now()}`;

    const res = await fetch("https://llcrjx8j5c.execute-api.us-east-1.amazonaws.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concernId: concernId,
        concernText: finalMessage,
        userId: "user42",
        bookingRef: "BR-12345",
        timestamp: new Date().toISOString()
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();

    // Build the follow-up link for the customer
    const followupURL = `http://localhost:5173/customer_followup.html?concernId=C1754059587663&operator=44086448-f011-70dd-db8e-75e4cb8c8e85`;

    // Update chat messages with full info and link
    setMessages((msgs) => [
      ...msgs,
      { 
        from: "bot", 
        text: `✅ **Concern Submitted Successfully!**\n\n` +
              `Concern ID: **${concernId}**\n` +
              `Assigned Operator: **${result.assignedOperator || "TBD"}**\n\n` +
              `🔗 [Click here to track & send follow-ups](${followupURL})`
      },
    ]);
  } catch (err) {
    console.error("Error:", err);
    setMessages((msgs) => [
      ...msgs,
      { from: "bot", text: "❌ Error submitting concern. Please try again later." }
    ]);
  } finally {
    setIsLoading(false);
  }
};


  // Option click handler - NOW HANDLES ALL OPTIONS
  const handleOptionClick = (type) => {
    if (type === "concern") {
      setMode("concern");
      setConcernStep(0);
      setConcernData({ what: "", when: "", scooter: "", location: "" });
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "🔧 **Submit a Concern**\nPlease describe briefly what happened." },
      ]);
    } else if (type === "feedback") {
      setMode("feedback");
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "💬 **Give Feedback**\nPlease share your thoughts about our service. What went well or what could be improved?" },
      ]);
    } else if (type === "booking") {
      setMode("booking");
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "📋 **View Booking Info**\nPlease enter your booking reference number, or type 'current' to see your active booking." },
      ]);
    } else if (type === "help") {
      setMode("help");
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "🆘 **Navigation Help**\nWhat do you need help with? You can ask about unlocking, payment, parking, safety, or support." },
      ]);
    }
  };

  // Add a back to menu function
  const backToMenu = () => {
    setMode("default");
    setConcernStep(0);
    setConcernData({ what: "", when: "", scooter: "", location: "" });
    setMessages((prev) => [
      ...prev,
      { from: "bot", text: "🏠 Back to main menu. How can I help you today?" },
    ]);
  };

  return (
    <div className="chatbot-container">
      {!open && <button className="chatbot-button" onClick={() => setOpen(true)}>💬</button>}

      {open && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div>
              <div style={{ fontWeight: "bold" }}>DALScooter Assistant</div>
              <div style={{ fontSize: "12px", opacity: 0.9 }}>
                {mode !== "default" ? `Mode: ${mode}` : "Online now"}
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "white" }}>✖</button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} style={{ textAlign: msg.from === "user" ? "right" : "left" }}>
                <span className={`chatbot-message ${msg.from === "user" ? "user" : "bot"}`}>{msg.text}</span>
              </div>
            ))}
            {isLoading && <div className="chatbot-message bot">Typing...</div>}
            <div ref={messagesEndRef} />
          </div>

          {mode === "default" && (
            <div className="chatbot-options">
              {options.map((opt, idx) => (
                <button key={idx} className="chatbot-option-button" onClick={() => handleOptionClick(opt.type)}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {mode !== "default" && (
            <div className="chatbot-options">
              <button className="chatbot-option-button" onClick={backToMenu} style={{ backgroundColor: "#666" }}>
                ← Back to Menu
              </button>
            </div>
          )}

          <div className="chatbot-input-container">
            <textarea
              className="chatbot-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              rows={1}
              placeholder={
                mode === "concern" ? "Answer here..." :
                mode === "feedback" ? "Share your feedback..." :
                mode === "booking" ? "Enter booking reference or 'current'..." :
                mode === "help" ? "What do you need help with?" :
                "Type your message..."
              }
              disabled={isLoading}
            />
            <button className="chatbot-send-button" onClick={sendMessage} disabled={isLoading || !input.trim()}>
              {isLoading ? "⏳" : "➤"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatBot;