# Clustify - MailPilot Cleanup Bot

A Chrome extension that helps you clean up your Gmail inbox by deleting emails based on custom keywords. Perfect for removing promotional emails, newsletters, and other unwanted messages in bulk.

## 🚀 Features

- **Gmail OAuth Integration**: Secure authentication with Google's OAuth2
- **Custom Keyword Search**: Find and delete emails containing specific keywords
- **Batch Operations**: Efficiently process large numbers of emails
- **Email Preview**: Preview email subjects before deletion for safety
- **Real-time Progress**: Live updates during deletion process
- **Token Management**: Automatic token validation and refresh

## 📋 Prerequisites

- Mozilla Firefox browser
- A Google account with Gmail access
- Google Cloud Console project with Gmail API enabled

## 🛠️ Setup Instructions

### 1. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth2 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add your extension ID to authorized origins
5. Update the `CLIENT_ID` in `background.js` with your credentials

### 2. Extension Installation

1. Clone or download this repository
2. Open Firefox and navigate to `Firefox://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The MailPilot icon should appear in your Chrome toolbar

### 3. Configuration

Update the `CLIENT_ID` constant in `background.js`:

```javascript
const CLIENT_ID = "your-client-id-here.apps.googleusercontent.com";
```

## 📁 Project Structure

```
Clustify/
├── manifest.json         # Extension configuration
├── background.js         # Background script handling OAuth
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic and Gmail API calls
├── style.css             # UI styling
└── README.md             # This file
```

## Video proof



https://github.com/user-attachments/assets/36e52c85-e266-46bf-9e8e-3916d206d5de


## 🎯 Usage

### Connecting to Gmail

1. Click the MailPilot extension icon in Chrome
2. Click "Connect Gmail" button
3. Authorize the extension to access your Gmail account
4. Once connected, the interface will enable all features

### Deleting Emails by Keyword

1. Enter a keyword in the "Custom Keyword Search" field
2. Click "Count by Keyword" to see how many emails match
3. Click "Delete by Keyword" to preview and delete matching emails
4. Confirm deletion in the preview modal

## 🔧 Technical Details

### API Endpoints Used

- **Gmail Profile**: `GET /gmail/v1/users/me/profile`
- **Message Search**: `GET /gmail/v1/users/me/messages`
- **Message Details**: `GET /gmail/v1/users/me/messages/{id}`
- **Batch Delete**: `POST /gmail/v1/users/me/messages/batchDelete`

### Key Features

- **Pagination Handling**: Automatically fetches all pages of search results
- **Batch Processing**: Deletes up to 1,000+ emails per API call
- **Error Handling**: Comprehensive error handling with user feedback
- **Token Management**: Automatic token storage and validation


## ⚠️ Safety Features

- **Preview Before Delete**: Always shows email subjects before deletion
- **User Confirmation**: Requires explicit confirmation before deletion
- **Progress Updates**: Real-time feedback during operations
- **Error Recovery**: Handles API errors gracefully

## 🔒 Permissions

The extension requires the following permissions:

- `identity`: For Google OAuth authentication
- `storage`: For storing authentication tokens
- `https://gmail.googleapis.com/*`: Gmail API access
- `https://www.googleapis.com/*`: Google APIs access
- `https://accounts.google.com/*`: Google authentication

## 🐛 Troubleshooting

### Common Issues

**"Token expired" error**:
- Click "Connect Gmail" again to re-authenticate

**"No emails found" when you expect results**:
- Check your keyword spelling
- Try broader search terms
- Ensure you're searching in the correct Gmail account

**Extension not loading**:
- Check that all files are in the correct directory
- Verify manifest.json syntax
- Check Chrome's extension error logs

### Debug Information

The extension provides detailed console logging. To view:
1. Right-click the extension popup
2. Select "Inspect"
3. Check the Console tab for detailed logs

## 🚧 Development

### Code Structure

- **Background Script** (`background.js`): Handles OAuth flow and token management
- **Popup Script** (`popup.js`): Main application logic and Gmail API interactions
- **UI** (`popup.html`): Extension interface

### Adding New Features

1. Add UI elements to `popup.html`
2. Add event listeners in `popup.js`
3. Implement Gmail API calls using the existing pattern
4. Update permissions in `manifest.json` if needed

## 📝 License

This project is open source. Please ensure you comply with Google's API usage policies and terms of service.

## ⚠️ Disclaimer

This extension permanently deletes emails from your Gmail account. Always preview emails before deletion and use at your own risk. The developers are not responsible for any data loss.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Firefox extension developer documentation
3. Check Gmail API documentation
4. Open an issue in the project repository

---

**Note**: Remember to keep your OAuth credentials secure and never commit them to version control.
