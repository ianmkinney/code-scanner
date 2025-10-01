# ZYN Rewards Integration

This document explains the ZYN rewards redemption feature integrated into the scanner application.

## Overview

The application now includes functionality to redeem ZYN reward codes directly through the ZYN Rewards API. Users can redeem individual codes or batch redeem multiple codes at once.

## Features

### 🔄 Redemption Options
- **Individual Redemption**: Click "Redeem" button next to any unredeemed code
- **Batch Redemption**: Select multiple codes using checkboxes and click "Auto-Redeem Selected"
- **Filter Views**: Filter codes by All/Unredeemed/Redeemed status

### 📊 Visual Indicators
- **Redeemed codes**: Highlighted in green with checkmark (✓)
- **Unredeemed codes**: Standard appearance with redemption options
- **Selected codes**: Checkboxes show selection for batch operations

### 🛡️ Error Handling
- **Network errors**: Graceful handling of API connectivity issues
- **Invalid codes**: Clear error messages for invalid/expired codes
- **Already redeemed**: Detection and prevention of duplicate redemptions

## API Integration

### Endpoints
- `POST /api/redeem-code` - Redeem individual codes
- `POST /api/redeem-batch` - Redeem multiple codes (up to 10 at once)

### ZYN API Integration
The application integrates with ZYN's redemption endpoint:
- **URL**: `https://us.zyn.com/rewardsblock/redeemcode/`
- **Method**: POST
- **Format**: Form-encoded data (`code=CODE_VALUE`)
- **Rate Limiting**: 500ms delay between batch requests

### Development Mode
In development environment, codes starting with "TEST" are automatically simulated as successfully redeemed for testing purposes.

## Database Schema

### New Columns Added to `scanned_codes` table:
- `redeemed` (boolean) - Whether the code has been redeemed
- `redeemed_at` (timestamp) - When the code was redeemed
- `redemption_error` (text) - Error message if redemption failed

### Setup Required
Run the SQL script in `security/add-redeemed-column.sql` in your Supabase dashboard to add the new columns.

## Usage Instructions

### For Users:
1. **Scan codes** using the camera scanner as usual
2. **Login** with your username to access your codes
3. **View codes** in the "Your Scanned Cans" section
4. **Filter codes** using the dropdown (All/Unredeemed/Redeemed)
5. **Redeem individually** by clicking the "Redeem" button
6. **Batch redeem** by selecting multiple codes and clicking "Auto-Redeem Selected"

### For Developers:
1. **Test with simulated codes**: Use codes starting with "TEST" in development mode
2. **Monitor logs**: Check server logs for ZYN API responses and errors
3. **Handle rate limits**: The system automatically handles delays between requests

## Troubleshooting

### Common Issues:
- **"ZYN rewards service unavailable"**: The ZYN API returned an HTML error page
- **"Invalid reward code"**: The code format is incorrect or doesn't exist
- **"Code already redeemed"**: The code has already been used
- **"Network error"**: Connection issues with ZYN's servers

### Debugging:
- Check server logs for detailed error messages
- Verify network connectivity to `us.zyn.com`
- Ensure proper headers are being sent to ZYN's API

## Security Considerations

- **Rate Limiting**: Built-in rate limiting prevents API abuse
- **User Authentication**: Redemptions are tied to authenticated users
- **Error Logging**: Failed redemptions are logged for debugging
- **Input Validation**: All codes are validated before submission

## Future Enhancements

- **Authentication Integration**: Direct integration with ZYN user accounts
- **Reward Points Tracking**: Display accumulated points from redemptions
- **Batch Size Optimization**: Adjustable batch sizes based on API performance
- **Retry Logic**: Automatic retry for failed redemptions

