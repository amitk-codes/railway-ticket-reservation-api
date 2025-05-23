# Railway Ticket Reservation API

A RESTful API that manages railway ticket reservations with a focus on proper berth allocation and booking constraints.

## Features

- Book railway tickets with proper berth allocation
- Handle confirmed, RAC, and waiting-list tickets
- Priority allocation for senior citizens and women with children
- Concurrency control to prevent double booking
- Ticket cancellation with automatic promotion logic
- Check ticket availability and view detailed booking information

## Core Constraints

- 63 confirmed berths total
- 9 RAC berths that can hold 18 RAC tickets (2 passengers per side-lower berth)
- 10 waiting-list tickets maximum
- Children under age 5 do not get a berth but their details are stored
- Priority for lower berths:
  - Passengers aged 60+
  - Ladies with children, if a lower berth is still available
- RAC passengers are allocated side-lower berths

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up PostgreSQL database
4. Configure environment variables in `.env` file
5. Run database setup script: `npm run setup`
6. Start the server:
   - Development mode: `npm run dev`
   - Production mode: `npm start`
   - Setup and start in one command: `npm run setup-and-start`

## Docker Deployment

The project includes Docker support with convenient npm scripts for easy deployment.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Quick Start

```bash
# Setup and start with Docker (recommended)
npm run docker:setup

# Or manually start services
npm run docker:up
```

### Available Docker Commands

```bash
# Build Docker images
npm run docker:build

# Start services in background
npm run docker:up

# Start services in development mode (with logs)
npm run docker:dev

# Start services in production mode
npm run docker:prod

# Check service status
npm run docker:status

# Restart services
npm run docker:restart

# Stop services
npm run docker:down

# Clean up (remove containers and volumes)
npm run docker:clean

# Complete cleanup (remove everything including images)
npm run docker:clean:all
```

### Access the API

Once started, the API will be available at:
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## API Endpoints

### Get Available Tickets

- **GET /api/v1/tickets/available** - Get ticket availability information

**Example curl command:**

```bash
curl -X GET http://localhost:3000/api/v1/tickets/available
```

**Example Response:**

```json
{
  "success": true,
  "message": "Ticket availability retrieved successfully",
  "data": {
    "availability": {
      "confirmed": {
        "total": 63,
        "booked": 63,
        "available": 0,
        "status": "FULL"
      },
      "rac": {
        "total": 18,
        "booked": 17,
        "available": 1,
        "status": "AVAILABLE"
      },
      "waitingList": {
        "total": 10,
        "booked": 0,
        "available": 10,
        "status": "AVAILABLE"
      },
      "overall": {
        "status": "RAC_AVAILABLE"
      }
    }
  }
}
```

### Get Booked Tickets

- **GET /api/v1/tickets/booked** - Get all booked tickets with passenger details and summary

**Example curl command:**

```bash
curl -X GET http://localhost:3000/api/v1/tickets/booked
```

**Example Response:**

```json
{
  "success": true,
  "message": "Booked tickets retrieved successfully",
  "data": {
    "summary": {
      "confirmed": 63,
      "rac": 17,
      "waitingList": 0,
      "total": 80
    },
    "bookedTickets": {
      "confirmed": {
        "count": 63,
        "tickets": [
          {
            "pnr": "ABC1234",
            "berth": {
              "number": 1,
              "type": "LOWER"
            },
            "passenger": {
              "name": "John Doe",
              "age": 35,
              "gender": "MALE",
              "hasChildUnderFive": false
            },
            "children": []
          }
        ]
      },
      "rac": {
        "count": 17,
        "tickets": [
          {
            "pnr": "DEF5678",
            "racNumber": 1,
            "berth": {
              "number": 64,
              "type": "SIDE_LOWER"
            },
            "passenger": {
              "name": "Jane Smith",
              "age": 28,
              "gender": "FEMALE",
              "hasChildUnderFive": false
            },
            "children": []
          }
        ]
      },
      "waitingList": {
        "count": 0,
        "tickets": []
      }
    }
  }
}
```

### Book a Ticket

- **POST /api/v1/tickets/book** - Book a new ticket

**Example curl command:**

```bash
# Book a ticket for an adult passenger
curl -X POST http://localhost:3000/api/v1/tickets/book \
  -H "Content-Type: application/json" \
  -d '{
    "passenger": {
      "name": "John Doe",
      "age": 35,
      "gender": "MALE"
    }
  }'
```

```bash
# Book a ticket for a senior citizen (priority for lower berth)
curl -X POST http://localhost:3000/api/v1/tickets/book \
  -H "Content-Type: application/json" \
  -d '{
    "passenger": {
      "name": "Sarah Johnson",
      "age": 65,
      "gender": "FEMALE"
    }
  }'
```

```bash
# Book a ticket for a woman with child under 5 (priority for lower berth)
curl -X POST http://localhost:3000/api/v1/tickets/book \
  -H "Content-Type: application/json" \
  -d '{
    "passenger": {
      "name": "Mary Smith",
      "age": 32,
      "gender": "FEMALE"
    },
    "children": [
      {
        "name": "Bobby Smith",
        "age": 4,
        "gender": "MALE"
      }
    ]
  }'
```

**Example Response:**

```json
{
  "success": true,
  "message": "Ticket booked successfully",
  "data": {
    "pnr": "ABC1234",
    "status": "CONFIRMED",
    "passenger": {
      "name": "John Doe",
      "age": 35,
      "gender": "MALE"
    },
    "berth_id": 1,
    "waiting_list_number": null,
    "rac_number": null,
    "children": []
  }
}
```

### Cancel a Ticket

- **POST /api/v1/tickets/cancel/:pnr** - Cancel a ticket by PNR

**Cancellation Logic:**
- When a confirmed ticket is canceled, the next RAC ticket (if any) should become confirmed
- Then, one waiting-list passenger (if any) should move to RAC

**Example curl command:**

```bash
curl -X POST http://localhost:3000/api/v1/tickets/cancel/ABC1234
```

**Example Response:**

```json
{
  "success": true,
  "message": "Ticket cancelled successfully",
  "data": {
    "pnr": "ABC1234"
  }
}
```

### Get Ticket Details

- **GET /api/v1/tickets/:pnr** - Get ticket details by PNR

**Example curl command:**

```bash
curl -X GET http://localhost:3000/api/v1/tickets/ABC1234
```

**Example Response:**

```json
{
  "success": true,
  "message": "Ticket details retrieved successfully",
  "data": {
    "id": 1,
    "pnr": "ABC1234",
    "status": "CONFIRMED",
    "waiting_list_number": null,
    "rac_number": null,
    "name": "John Doe",
    "age": 35,
    "gender": "MALE",
    "has_child_under_five": false,
    "berth_number": 1,
    "berth_type": "LOWER",
    "children": []
  }
}
```

## Postman Collection

A comprehensive Postman collection is provided in the `data/` directory to help you test all API endpoints easily.

### Import the Collection

1. Open Postman
2. Click on "Import" button
3. Select the file `data/Railway_Reservation_API.postman_collection.json`
4. The collection will be imported with all endpoints and example requests

### Collection Features

The Postman collection includes:

- **Health Check** - Test if the API is running
- **Availability & Status** - Check ticket availability and view all booked tickets
- **Ticket Booking** - Examples for different passenger types:
  - Regular adult passengers
  - Senior citizens (60+ years)
  - Women with children under 5
- **Validation Tests** - Test error handling for invalid inputs
- **Ticket Retrieval** - Get ticket details by PNR
- **Ticket Cancellation** - Cancel tickets and test promotion logic
- **Error Handling** - Test 404 and 400 error scenarios

### Environment Variables

The collection uses a base URL variable:
- `base_url`: Set to `http://localhost:3000` by default
- You can modify this in Postman's environment settings if your server runs on a different port

### Usage Tips

1. Start with the "Health Check" request to ensure your server is running
2. Use "Get Ticket Availability" to check current status
3. Try booking different types of passengers to see berth allocation logic
4. After booking, note the PNR from the response and use it in "Get Ticket by PNR" and "Cancel Ticket" requests
5. Use the validation tests to understand error handling

## Tech Stack Used

- Node.js
- PostgreSQL
