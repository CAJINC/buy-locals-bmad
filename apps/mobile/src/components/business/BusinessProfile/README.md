# Enhanced Business Hours Display Component

A comprehensive, feature-rich React Native component for displaying business hours with real-time status updates, timezone support, special hours handling, and interactive features.

## Features

### 🕒 Real-time Status Updates
- Live open/closed status calculation
- Automatic updates every minute (configurable)
- Countdown timers for next status change ("Opens in 2h 30m", "Closes in 45m")

### 🌍 Timezone Support
- Convert business hours to user's local timezone
- Display timezone information and abbreviations
- Support for all major timezone formats

### ⭐ Special Hours & Closures
- Holiday hours with custom reasons
- Temporary closures (renovations, vacations, etc.)
- Visual indicators for special hours

### 🎯 Interactive Features
- Expandable/collapsible hours display
- Compact and full view modes
- Grouped consecutive days with same hours
- Touch interactions for better UX

### 🔍 Advanced Business Logic
- 24-hour business support
- Overnight hours (closes after midnight)
- Edge case handling for complex schedules
- Comprehensive validation and error handling

### 📱 Mobile-Optimized
- Responsive design for all screen sizes
- Smooth animations and transitions
- Accessibility support
- Performance optimized with memoization

## Installation

The component is part of the Buy Locals mobile app and uses the following dependencies:

```bash
# Required dependencies (already in project)
npm install native-base react-native-vector-icons
```

## Basic Usage

```tsx
import { BusinessHoursDisplay } from '../components/business/BusinessProfile/BusinessHoursDisplay';

const basicHours = {
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' },
  thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' },
  saturday: { open: '10:00', close: '16:00' },
  sunday: { closed: true },
};

function MyComponent() {
  return (
    <BusinessHoursDisplay 
      hours={basicHours}
      showCurrentStatus={true}
      showCountdown={true}
    />
  );
}
```

## Enhanced Usage with Special Hours

```tsx
import { EnhancedBusinessHours } from '../components/business/BusinessProfile/types';

const restaurantHours: EnhancedBusinessHours = {
  // Regular hours
  monday: { open: '11:00', close: '22:00' },
  tuesday: { open: '11:00', close: '22:00' },
  wednesday: { open: '11:00', close: '22:00' },
  thursday: { open: '11:00', close: '22:00' },
  friday: { open: '11:00', close: '23:00' },
  saturday: { open: '10:00', close: '23:00' },
  sunday: { open: '10:00', close: '21:00' },
  
  // Business timezone
  timezone: 'America/New_York',
  
  // Special holiday hours
  specialHours: {
    '2025-12-25': {
      open: '00:00',
      close: '00:00',
      isClosed: true,
      reason: 'Christmas Day',
    },
    '2025-12-31': {
      open: '11:00',
      close: '14:00',
      isClosed: false,
      reason: 'New Year\'s Eve - Limited Hours',
    },
  },
  
  // Temporary closures
  temporaryClosures: [
    {
      startDate: '2025-01-15',
      endDate: '2025-01-17',
      reason: 'Kitchen Renovation',
    },
  ],
};

function RestaurantHours() {
  const handleStatusChange = (status) => {
    console.log('Business status changed:', status);
  };

  return (
    <BusinessHoursDisplay 
      hours={restaurantHours}
      showCurrentStatus={true}
      showCountdown={true}
      showTimezone={true}
      userTimezone="America/Los_Angeles" // User's timezone
      expandable={true}
      showSpecialHours={true}
      onStatusChange={handleStatusChange}
      refreshInterval={60000} // Update every minute
    />
  );
}
```

## Props

### EnhancedBusinessHoursDisplayProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hours` | `Business['hours'] \| EnhancedBusinessHours` | **required** | Business hours data |
| `compact` | `boolean` | `false` | Show compact view with grouped days |
| `showCurrentStatus` | `boolean` | `true` | Display open/closed status badge |
| `showCountdown` | `boolean` | `true` | Show countdown to next status change |
| `showTimezone` | `boolean` | `true` | Display timezone information |
| `userTimezone` | `string` | auto-detect | User's timezone for conversion |
| `expandable` | `boolean` | `true` | Allow expanding/collapsing hours |
| `showSpecialHours` | `boolean` | `true` | Show special hours indicators |
| `onStatusChange` | `(status: BusinessStatus) => void` | `undefined` | Callback for status changes |
| `refreshInterval` | `number` | `60000` | Update interval in milliseconds |

### EnhancedBusinessHours Interface

```typescript
interface EnhancedBusinessHours {
  // Regular weekly hours
  [day: string]: {
    open?: string;        // 24-hour format (e.g., "09:00")
    close?: string;       // 24-hour format (e.g., "17:00")
    closed?: boolean;     // Day is closed
    isClosed?: boolean;   // Alternative closed flag
  };
  
  // Optional enhancements
  timezone?: string;      // Business timezone (e.g., "America/New_York")
  
  // Special hours for holidays/events
  specialHours?: {
    [date: string]: {     // ISO date format (e.g., "2025-12-25")
      open: string;
      close: string;
      isClosed: boolean;
      reason: string;     // Reason for special hours
    };
  };
  
  // Temporary closures
  temporaryClosures?: {
    startDate: string;    // ISO date format
    endDate: string;      // ISO date format
    reason: string;       // Reason for closure
  }[];
}
```

### BusinessStatus Interface

```typescript
interface BusinessStatus {
  isOpen: boolean;           // Currently open or closed
  status: 'open' | 'closed' | 'unknown';
  reason?: string;           // Reason for status (e.g., "24 Hours", "Holiday")
  nextChange: Date | null;   // When status will next change
}
```

## Advanced Features

### 24-Hour Businesses

```tsx
const alwaysOpen = {
  monday: { open: '00:00', close: '23:59' },
  tuesday: { open: '00:00', close: '23:59' },
  // ... other days
};
```

### Overnight Hours (Past Midnight)

```tsx
const barHours = {
  friday: { open: '17:00', close: '02:00' }, // Closes at 2 AM Saturday
  saturday: { open: '17:00', close: '03:00' }, // Closes at 3 AM Sunday
  // ... other days
};
```

### Seasonal Businesses

```tsx
const seasonalHours: EnhancedBusinessHours = {
  // Regular hours during season
  monday: { open: '09:00', close: '18:00' },
  // ... other days
  
  // Closed for entire off-season
  temporaryClosures: [
    {
      startDate: '2025-05-01',
      endDate: '2025-11-30',
      reason: 'Closed for Summer Season',
    },
  ],
};
```

## Utility Functions

The component includes comprehensive utility functions in `utils/hoursUtils.ts`:

### Time & Date Utilities
- `formatTo12Hour(time)` - Convert 24-hour to 12-hour format
- `getCurrentDayIndex(date)` - Get day index (Monday = 0)
- `isValidTimeFormat(time)` - Validate time format

### Timezone Utilities
- `convertToTimezone(date, timezone)` - Convert date to timezone
- `getTimezoneInfo(timezone)` - Get timezone details
- `getTimezoneOffset(timezone)` - Get UTC offset

### Business Logic
- `calculateBusinessStatus(hours, currentTime)` - Get current status
- `findNextOpenTime(hours, currentTime)` - Find next opening
- `findNextCloseTime(hours, currentTime)` - Find next closing
- `isTimeInRange(time, open, close, timezone)` - Check if time is within range

### Validation
- `validateBusinessHours(hours)` - Comprehensive validation
- `groupConsecutiveDays(hours, currentTime)` - Group same hours

## Testing

Comprehensive test suite included in `__tests__/BusinessHoursDisplay.test.tsx`:

```bash
# Run tests
npm test BusinessHoursDisplay

# Run with coverage
npm test -- --coverage BusinessHoursDisplay
```

Test coverage includes:
- Basic functionality and rendering
- Enhanced features (special hours, timezones)
- Status calculations (open/closed logic)
- Edge cases (24-hour, overnight, invalid data)
- Real-time updates and callbacks
- Error handling and validation

## Examples

See comprehensive examples in `examples/BusinessHoursExamples.tsx`:

1. **Basic Office Hours** - Standard 9-5 business
2. **Restaurant with Special Hours** - Holiday hours and closures
3. **24-Hour Convenience Store** - Always open business
4. **Bar with Overnight Hours** - Past midnight closing
5. **Medical Clinic** - Irregular professional hours
6. **Seasonal Ski Shop** - Long-term seasonal closures

## Performance Considerations

- **Memoization**: All expensive calculations are memoized
- **Efficient Updates**: Only updates when necessary
- **Minimal Re-renders**: Optimized with useCallback and useMemo
- **Lightweight**: Core component is only a few KB

## Browser/Device Support

- ✅ iOS (React Native)
- ✅ Android (React Native)
- ✅ All timezones supported
- ✅ RTL language support ready
- ✅ Accessibility features included

## Migration from Basic Component

The enhanced component is backward compatible with the basic BusinessHoursDisplay:

```tsx
// Old usage (still works)
<BusinessHoursDisplay 
  hours={basicHours}
  compact={true}
  showCurrentStatus={true}
/>

// New enhanced usage
<BusinessHoursDisplay 
  hours={enhancedHours} // Can include special hours
  compact={true}
  showCurrentStatus={true}
  showCountdown={true}        // New feature
  showTimezone={true}         // New feature
  expandable={true}           // New feature
  onStatusChange={callback}   // New feature
/>
```

## Contributing

When contributing to this component:

1. Add tests for new features
2. Update TypeScript interfaces
3. Document new props and features
4. Include examples for complex features
5. Ensure backward compatibility

## License

Part of the Buy Locals mobile application. All rights reserved.