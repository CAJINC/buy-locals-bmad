# Epic 2: Business Profile & Discovery System

**Epic Goal:** Create a comprehensive business discovery experience that allows consumers to easily find local businesses while providing businesses with rich profile capabilities to showcase their offerings effectively.

## Story 2.1: Enhanced Business Profile Pages

As a **consumer**,
I want **to view detailed business profiles with comprehensive information, photos, and services**,
so that **I can make informed decisions about which local businesses to engage with**.

### Acceptance Criteria
1. Business profile displays complete information: name, description, address, contact details, hours, and website
2. Photo gallery shows business logo, interior/exterior photos, and product/service images with lightbox viewing
3. Services/products catalog allows businesses to list offerings with descriptions and pricing information
4. Business hours display shows current open/closed status and special holiday hours
5. Location map integration shows business location with directions link
6. Contact methods clearly presented (phone, email, website) with click-to-call functionality on mobile
7. Business category tags help consumers understand the type of business
8. Profile pages are mobile-responsive and load quickly on all devices

## Story 2.2: Location-Based Business Discovery

As a **consumer**,
I want **to discover businesses near my current location or a specified area**,
so that **I can find relevant local services and products when I need them**.

### Acceptance Criteria
1. GPS-based location detection requests user permission and uses current coordinates for search
2. Manual location entry allows users to search specific addresses or neighborhoods
3. Distance-based search returns businesses within specified radius (1, 5, 10, 25 miles)
4. Map view displays business locations with markers showing business type icons
5. List view shows businesses sorted by distance with basic info (name, category, distance, rating preview)
6. Location search performance returns results within 1 second for optimal user experience
7. Geolocation accuracy handles both precise GPS coordinates and approximate zip code areas
8. Search results update automatically when user changes location or moves map view

## Story 2.3: Business Search & Filtering

As a **consumer**,
I want **to search for businesses by name, category, or service and filter results**,
so that **I can quickly find specific types of businesses that meet my needs**.

### Acceptance Criteria
1. Text search functionality searches business names, descriptions, and service keywords
2. Category filtering allows selection of business types (restaurants, retail, services, health, automotive, etc.)
3. Multiple filters can be combined (location + category + keyword) to narrow results
4. Search suggestions appear as user types, showing matching business names and popular categories
5. Filter options show result counts to help users understand available choices
6. Clear filter/reset functionality returns to unfiltered view
7. Search results maintain sort options (distance, rating, recently added)
8. Empty search results provide helpful suggestions and nearby alternatives

## Story 2.4: Business Hours & Availability Display

As a **consumer**,
I want **to see current business hours and availability status**,
so that **I know when businesses are open and can plan my visits accordingly**.

### Acceptance Criteria
1. Current open/closed status prominently displayed on business profiles
2. Full weekly hours schedule shows standard operating hours for each day
3. Special hours handling for holidays, temporary closures, and modified schedules
4. "Opens at" or "Closes at" messaging shows next status change with countdown timer
5. Business owners can set temporary hour changes that override standard schedules
6. Time zone handling ensures accurate hours display for user's location
7. Mobile app shows hours in user's local time regardless of business location
8. Hours information is clearly visible in search results and business cards
