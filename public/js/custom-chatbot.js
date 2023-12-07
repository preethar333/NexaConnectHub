// Get the chatbot container and messages div
const chatbotContainer = document.getElementById('chatbot-container');
const messagesDiv = document.getElementById('chatbot-messages');

// Minimize the chatbot by default
chatbotContainer.classList.add('minimized');

function toggleChatbot(maximize = false) {
    // Toggle the 'minimized' class based on the maximize parameter
    chatbotContainer.classList.toggle('minimized', !maximize);
  }
  
  function closeChatbot() {
    // Add the 'minimized' class to minimize the chatbot
    chatbotContainer.classList.add('minimized');
  }

// Function to send user messages
function sendMessage() {
  const userInput = document.getElementById('user-input').value;

  // Display user message
  displayMessage('user', userInput);

  // Process user input
  processUserInput(userInput);

  // Clear user input
  document.getElementById('user-input').value = '';
}

// Add an event listener for the "Enter" key
document.getElementById('user-input').addEventListener('keyup', function (event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

// Function to process user input and generate chatbot response
function processUserInput(userInput) {
  // Convert user input to lowercase for case-insensitive matching
  const lowerCaseInput = userInput.toLowerCase();

  // Check for keywords in user input and generate appropriate responses
  if (lowerCaseInput.includes('hello') || lowerCaseInput.includes('hi')) {
    displayMessage('bot', 'Welcome to Nexaconnect Hub! How may I help you? Please select the option you want help with:\n1. Making Payments\n2. Creating a Post\n3. Waiting time for admin approval');
  } else if (lowerCaseInput.includes('bye') || lowerCaseInput.includes('goodbye')) {
    displayMessage('bot', 'Goodbye! Have a great day!');
  } else if (lowerCaseInput.includes('1') || lowerCaseInput.includes('payments')) {
    displayMessage('bot', 'Great! Kindly wait until we connect you with our agent.');
  } else if (lowerCaseInput.includes('2') || lowerCaseInput.includes('creating a post')) {
    displayMessage('bot', 'Sure! To create a post, go to the "Create Post" section on our website and follow the instructions.');
  } else if (lowerCaseInput.includes('3') || lowerCaseInput.includes('waiting time') || lowerCaseInput.includes('admin approval')) {
    displayMessage('bot', 'If you are waiting for admin approval, please be patient. Our team will review your request as soon as possible.');
  } else {
    // If no specific keyword matched, provide a generic response
    displayMessage('bot', 'Thank you for your message! How can I assist you?');
  }
}

// Function to display messages in the chat
function displayMessage(sender, message) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender);
  messageDiv.textContent = `${sender.charAt(0).toUpperCase() + sender.slice(1)}: ${message}`;

  messagesDiv.appendChild(messageDiv);

  // Scroll to the bottom of the messages div
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Attach the toggleChatbot function to the button click event
document.getElementById('toggleChatbot').addEventListener('click', function () {
  toggleChatbot();
});

// Attach the closeChatbot function to the "Close" button click event
document.getElementById('close-button').addEventListener('click', function () {
  closeChatbot();
});

// Attach the sendMessage function to the "Send" button click event
document.getElementById('send-button').addEventListener('click', function () {
  sendMessage();
});
