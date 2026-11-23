# Shoplytics – Multi-Business E-commerce Intelligence Platform

> **Project Type:** Full-Stack Web Application  
> **Category:** SaaS / E-commerce Analytics  
> **Document:** Software Requirements Specification  
> **Version:** 1.1

---

# 1. Project Overview

## 1.1 Project Title

**Shoplytics – Unified E-commerce Intelligence & Business Analytics Platform**

## 1.2 Description

Shoplytics is a multi-business e-commerce analytics platform designed to help business owners monitor, analyze, and understand their business performance through interactive dashboards, visual reports, and data-driven insights.

The platform allows users to register, create, and manage multiple businesses under a single account.

Each business will have its own independent analytics environment containing:

- Sales analytics.
- Revenue statistics.
- Inventory reports.
- Product performance.
- Customer insights.
- Order analytics.
- Business performance reports.

Users can switch between businesses and access analytics specific to the selected business.

The platform transforms raw e-commerce data into meaningful visualizations using interactive charts, graphs, tables, and reports.

## 1.3 Core Concept

A single user can manage multiple businesses.

For example:

- Fashion Store
- Electronics Store
- Grocery Store

After logging in, the user can select a business and access its dedicated analytics dashboard.

Each business maintains independent data.

**Core principle:**

One User → Multiple Businesses → Independent Data → Dedicated Analytics → Business Insights.

---

# 2. Project Objectives

1. Build a centralized analytics platform for e-commerce businesses.
2. Allow users to create and manage multiple businesses.
3. Provide independent analytics for every business.
4. Generate interactive graphs using D3.js.
5. Provide sales, revenue, inventory, and customer reports.
6. Provide date-based analytics filtering.
7. Build a modern, responsive SaaS dashboard.
8. Implement a scalable backend using Node.js, Express.js, and TypeScript.
9. Use MongoDB as the primary database.
10. Use Prisma ORM for database operations.
11. Maintain secure business-specific data access.

---

# 3. Technology Stack

## 3.1 Frontend

| Technology | Purpose |
|---|---|
| React.js | Frontend development |
| TypeScript | Type safety |
| Redux Toolkit | Global state management |
| React Router | Application routing |
| Tailwind CSS | UI styling |
| Anime.js | UI animations |
| D3.js | Interactive charts and graphs |
| Axios | API communication |
| React Hook Form | Form management |
| Zod | Data validation |

## 3.2 Backend

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express.js | REST API development |
| TypeScript | Backend type safety |
| Prisma ORM | Database operations |
| JWT | Authentication |
| bcrypt | Password hashing |
| Zod | Request validation |

## 3.3 Database

**Database: MongoDB**

**ORM: Prisma ORM**

MongoDB will be used to store application data in collections and documents.

Prisma ORM will provide:
- Database queries.
- CRUD operations.
- Type-safe database access.
- Schema definitions.
- Data validation support through application-level validation.
- Database model management.

### Main Collections

- Users
- Businesses
- BusinessMembers
- Products
- Categories
- Customers
- Orders
- OrderItems
- InventoryMovements
- Reports

## 3.4 Additional Tools

| Tool | Purpose |
|---|---|
| Git & GitHub | Version control |
| Postman | API testing |
| ESLint | Code quality |
| Prettier | Code formatting |
| Docker | Containerization (optional) |

---

# 4. Application Architecture

The application will follow a modular client-server architecture.

## 4.1 High-Level Architecture

```text
                 USER
                   |
                   v
            REACT FRONTEND
              TypeScript
                   |
            Redux Toolkit
                   |
             React Router
                   |
             Axios Client
                   |
                   v
            EXPRESS BACKEND
              Node.js + TS
                   |
             Authentication
                   |
               Middleware
                   |
             Business Context
                   |
               Controllers
                   |
              Service Layer
                   |
                Prisma ORM
                   |
                   v
                MONGODB
                   |
          -------------------
          |        |        |
         Users  Business  Analytics
                  Data      Data
```

## 4.2 Application Flow

1. User opens the application.
2. User registers or logs in.
3. Backend validates credentials.
4. Backend generates an authentication token.
5. User is redirected to the business selection page.
6. User creates a business or selects an existing business.
7. Selected business becomes the active business context.
8. Frontend requests analytics for the selected business.
9. Backend verifies user access to the business.
10. Prisma ORM retrieves the required data from MongoDB.
11. Backend processes analytics information.
12. Frontend displays charts, graphs, statistics, and tables.
13. User can navigate between analytics modules.

---

# 5. Design System and Theme

The application must follow a consistent visual identity based on three primary colors:

**Deep Blue + Pure White + Bubblegum Pink**

The overall interface should feel modern, premium, clean, and professional while using pink as an accent color for visual personality.

## 5.1 Primary Color Palette

| Color | Hex Code | Usage |
|---|---|---|
| Deep Blue | `#142B5C` | Primary brand color, sidebar, navigation |
| Pure White | `#FFFFFF` | Main background, cards, content surfaces |
| Bubblegum Pink | `#FF85B3` | Accent color, highlights, buttons |

## 5.2 Supporting Colors

| Color | Hex Code | Usage |
|---|---|---|
| Light Blue | `#EAF0FA` | Secondary backgrounds |
| Soft Pink | `#FFF0F6` | Highlight backgrounds |
| Dark Blue | `#0B1938` | Hover states and dark accents |
| Slate | `#64748B` | Secondary text |
| Border Gray | `#E5E7EB` | Borders and dividers |
| Success Green | `#16A34A` | Positive indicators |
| Warning Amber | `#F59E0B` | Warnings |
| Error Red | `#DC2626` | Errors |

## 5.3 Theme Application

### Deep Blue

Use Deep Blue for:
- Sidebar background.
- Primary navigation.
- Main headings.
- Primary buttons.
- Selected navigation items.
- Brand identity elements.

### Pure White

Use Pure White for:
- Main content background.
- Dashboard cards.
- Forms.
- Tables.
- Modals.
- Chart containers.

### Bubblegum Pink

Use Bubblegum Pink for:
- Accent buttons.
- Important highlights.
- Active chart indicators.
- Selected filters.
- Interactive hover states.
- Dashboard accent elements.
- Notifications and visual highlights.

## 5.4 UI Design Guidelines

- Maintain a clean and minimal interface.
- Use rounded dashboard cards.
- Maintain consistent spacing.
- Use subtle shadows.
- Use clear typography.
- Avoid excessive use of pink.
- Maintain good contrast between text and backgrounds.
- Use consistent button and input styles.
- Ensure accessibility and responsive layouts.

## 5.5 Tailwind CSS Theme Configuration

Use reusable theme variables rather than hardcoding colors throughout the application.

Suggested CSS variables:

```css
:root {
  --color-primary: #142B5C;
  --color-primary-dark: #0B1938;
  --color-secondary: #FF85B3;
  --color-background: #FFFFFF;
  --color-light-blue: #EAF0FA;
  --color-soft-pink: #FFF0F6;
  --color-text: #142B5C;
  --color-muted: #64748B;
  --color-border: #E5E7EB;
}
```

All components should use these centralized theme values.

---

# 6. Core Features

## 6.1 Authentication and User Management

Users should be able to securely access the platform.

Features:
- User registration.
- User login.
- User logout.
- Forgot password.
- Reset password.
- JWT authentication.
- Password hashing.
- Protected routes.
- User profile management.

User information:
- Full name.
- Email.
- Password hash.
- Profile image.
- Account creation date.

## 6.2 Multi-Business Management

Users should be able to manage multiple businesses through one account.

Features:
- Create a business.
- View all businesses.
- Edit business information.
- Delete a business.
- Switch between businesses.
- Set a default business.
- View business-specific analytics.

### Business Information

- Business ID.
- Business name.
- Business description.
- Business category.
- Business logo.
- Currency.
- Time zone.
- Website.
- Creation date.

### Business Selection Page

Route: `/businesses`

Display:
- Business cards.
- Business logos.
- Business names.
- Business categories.
- Creation dates.
- Open dashboard actions.
- Edit and delete actions.
- Add new business button.

When a user selects a business:
1. Set the selected business as active.
2. Retrieve its information.
3. Fetch its analytics.
4. Load its dashboard.
5. Update the navigation context.

---

# 7. Application Pages and Modules

## 7.1 Landing Page

Route: `/`

Sections:
- Navigation bar.
- Hero section.
- Platform overview.
- Features.
- Benefits.
- Dashboard preview.
- Call-to-action.
- Footer.

## 7.2 Authentication Pages

### Login

Route: `/login`

Features:
- Email.
- Password.
- Remember me.
- Forgot password.
- Login button.
- Register link.

### Registration

Route: `/register`

Features:
- Full name.
- Email.
- Password.
- Confirm password.
- Terms and conditions.
- Register button.

### Forgot Password

Route: `/forgot-password`

Features:
- Email input.
- Password reset request.
- Confirmation message.

## 7.3 Business Selection

Route: `/businesses`

Features:
- List businesses.
- Search businesses.
- Add business.
- Edit business.
- Delete business.
- Select business.

## 7.4 Main Analytics Dashboard

Route: `/businesses/:businessId/dashboard`

This is the main analytics page.

### Sidebar Navigation

- Overview
- Sales Analytics
- Revenue Analytics
- Inventory
- Products
- Customers
- Orders
- Reports
- Business Settings

### Top Navigation

- Business selector.
- Global date filter.
- Notifications.
- User profile.
- Logout.

### Dashboard Statistics Cards

1. Total Revenue.
2. Total Orders.
3. Total Customers.
4. Total Products.
5. Average Order Value.
6. Total Units Sold.

Each card should display:
- Metric title.
- Current value.
- Percentage change.
- Previous period comparison.
- Relevant icon.
- Optional trend indicator.

### Dashboard Charts

**Revenue Overview**
- Line chart.
- Daily, weekly, monthly, yearly revenue.

**Sales Overview**
- Bar chart.
- Total sales over time.
- Orders over time.

**Order Status Distribution**
- Donut chart.
- Pending.
- Processing.
- Shipped.
- Delivered.
- Cancelled.

**Top-Selling Products**
- Horizontal bar chart.
- Product name.
- Units sold.
- Revenue.

**Sales by Category**
- Pie or donut chart.

**Recent Orders**
- Order ID.
- Customer.
- Order date.
- Amount.
- Status.

### Date Filters

- Today.
- Yesterday.
- Last 7 days.
- Last 30 days.
- Last 90 days.
- This month.
- Last month.
- This year.
- Custom date range.

All dashboard widgets must update according to the selected date range.

## 7.5 Sales Analytics

Route: `/businesses/:businessId/sales`

Features:
- Total sales.
- Total orders.
- Average order value.
- Units sold.
- Sales growth.
- Daily, weekly, monthly, yearly reports.

Charts:
- Sales trends.
- Sales by category.
- Sales by product.
- Orders over time.
- Order status distribution.

Filters:
- Date.
- Product.
- Category.
- Order status.

## 7.6 Revenue Analytics

Route: `/businesses/:businessId/revenue`

Statistics:
- Total revenue.
- Gross revenue.
- Net revenue.
- Discounts.
- Refunds.
- Tax collected.
- Revenue growth.

Charts:
- Revenue trends.
- Monthly comparison.
- Revenue by product.
- Revenue by category.
- Revenue by payment method.

Features:
- Compare date ranges.
- Filter revenue.
- Identify high-revenue products.
- View historical reports.

## 7.7 Inventory Management

Route: `/businesses/:businessId/inventory`

Statistics:
- Total Products.
- Total Stock Units.
- Low Stock Products.
- Out-of-Stock Products.
- Inventory Value.

Inventory Table:
- Product Image.
- Product Name.
- SKU.
- Category.
- Current Stock.
- Minimum Stock Level.
- Unit Cost.
- Stock Status.
- Last Updated.

Inventory Status:
- In Stock.
- Low Stock.
- Out of Stock.

Features:
- Search products.
- Filter by category.
- Filter by stock status.
- Update stock.
- Set stock thresholds.
- View stock movement history.

Inventory Reports:
- Current inventory.
- Low-stock report.
- Out-of-stock report.
- Inventory valuation.
- Stock movement history.

Charts:
- Stock distribution.
- Inventory status.
- Stock level comparison.
- Inventory value by category.

## 7.8 Products

Route: `/businesses/:businessId/products`

Features:
- Add product.
- Edit product.
- Delete product.
- Search products.
- Filter by category.
- Filter by price.
- View product performance.

Product Fields:
- Product ID.
- Product name.
- Description.
- SKU.
- Category.
- Price.
- Cost price.
- Stock quantity.
- Minimum stock level.
- Product image.
- Creation date.

Product Details:

Route: `/businesses/:businessId/products/:productId`

Display:
- Product information.
- Current inventory.
- Total units sold.
- Total revenue.
- Sales history.
- Stock movement history.

## 7.9 Customer Analytics

Route: `/businesses/:businessId/customers`

Statistics:
- Total Customers.
- New Customers.
- Returning Customers.
- Average Customer Lifetime Value.
- Average Orders per Customer.

Charts:
- Customer growth.
- New vs returning customers.
- Customer segmentation.
- Customer purchasing behavior.

Customer Segments:
- High-value customers.
- Regular customers.
- Inactive customers.

Customer Table:
- Customer Name.
- Email.
- Total Orders.
- Total Spent.
- Average Order Value.
- Last Purchase Date.
- Customer Type.

Customer Details:

Route: `/businesses/:businessId/customers/:customerId`

Display:
- Customer profile.
- Contact information.
- Total orders.
- Total amount spent.
- Average order value.
- Purchase history.
- Most purchased products.
- First purchase date.
- Last purchase date.

## 7.10 Orders

Route: `/businesses/:businessId/orders`

Features:
- View orders.
- Search orders.
- Filter by status.
- Filter by payment status.
- Filter by date.
- View order details.

Order Table:
- Order ID.
- Customer.
- Order Date.
- Items.
- Total Amount.
- Payment Status.
- Order Status.

Order Status:
- Pending.
- Processing.
- Shipped.
- Delivered.
- Cancelled.
- Refunded.

Order Details:

Route: `/businesses/:businessId/orders/:orderId`

Display:
- Order information.
- Customer details.
- Products purchased.
- Product quantities.
- Pricing breakdown.
- Shipping information.
- Payment information.
- Order timeline.

## 7.11 Reports

Route: `/businesses/:businessId/reports`

Available Reports:

**Sales**
- Daily sales.
- Weekly sales.
- Monthly sales.
- Yearly sales.
- Product sales.

**Inventory**
- Current inventory.
- Low-stock products.
- Out-of-stock products.
- Inventory valuation.

**Customers**
- Customer growth.
- New customers.
- Returning customers.
- High-value customers.

**Revenue**
- Revenue summary.
- Monthly revenue.
- Product revenue.
- Category revenue.

Report Generation:
1. Select report category.
2. Select report type.
3. Choose date range.
4. Apply filters.
5. Generate report.
6. Preview report.
7. Export report.

Export formats:
- CSV.
- PDF.

## 7.12 Business Settings

Route: `/businesses/:businessId/settings`

Features:
- Edit business name.
- Update description.
- Update logo.
- Change currency.
- Change time zone.
- Configure inventory alerts.
- Configure preferences.
- Delete business.

## 7.13 User Profile

Route: `/profile`

Features:
- View profile.
- Update name.
- Update email.
- Change password.
- Update profile image.
- Manage preferences.
- Logout.

---

# 8. Data Visualization Requirements

D3.js will be responsible for rendering interactive charts.

## 8.1 Required Chart Types

| Chart | Purpose |
|---|---|
| Line Chart | Revenue and sales trends |
| Bar Chart | Product performance |
| Horizontal Bar | Top-selling products |
| Pie Chart | Sales distribution |
| Donut Chart | Order and customer distribution |
| Area Chart | Revenue trends |
| Stacked Bar | Category comparison |
| Scatter Plot | Customer purchasing analysis |

## 8.2 Chart Styling

Charts should follow the primary application theme.

- Deep Blue for primary data series.
- Bubblegum Pink for secondary data series and highlights.
- Light Blue for supporting series.
- White chart backgrounds.
- Deep Blue text and labels.
- Neutral grid lines.

Avoid using the same colors for every chart series if it makes comparisons difficult.

## 8.3 Chart Interactions

Each chart should support:
- Hover tooltips.
- Interactive data points.
- Axis labels.
- Legends.
- Responsive resizing.
- Date filtering.
- Loading states.
- Empty states.

## 8.4 Example Chart Data

```json
{
  "businessId": "business_123",
  "period": "monthly",
  "data": [
    {
      "month": "January",
      "revenue": 25000,
      "orders": 120
    },
    {
      "month": "February",
      "revenue": 32000,
      "orders": 150
    },
    {
      "month": "March",
      "revenue": 28000,
      "orders": 135
    }
  ]
}
```

---

# 9. Backend Requirements

The backend will follow a modular MVC and service-layer architecture.

## 9.1 Backend Folder Structure

```text
backend/
│
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   └── environment.ts
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── business.controller.ts
│   │   ├── dashboard.controller.ts
│   │   ├── sales.controller.ts
│   │   ├── revenue.controller.ts
│   │   ├── inventory.controller.ts
│   │   ├── product.controller.ts
│   │   ├── customer.controller.ts
│   │   ├── order.controller.ts
│   │   └── report.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── business.service.ts
│   │   ├── analytics.service.ts
│   │   ├── sales.service.ts
│   │   ├── revenue.service.ts
│   │   ├── inventory.service.ts
│   │   ├── customer.service.ts
│   │   └── report.service.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── business.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   │
│   ├── routes/
│   ├── validators/
│   ├── utils/
│   ├── types/
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   └── schema.prisma
│
├── .env
├── package.json
└── tsconfig.json
```

## 9.2 API Requirements

Base URL:

`/api/v1`

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| POST | `/auth/forgot-password` | Request reset |
| POST | `/auth/reset-password` | Reset password |
| GET | `/auth/me` | Get current user |

### Business

| Method | Endpoint | Description |
|---|---|---|
| POST | `/businesses` | Create business |
| GET | `/businesses` | List businesses |
| GET | `/businesses/:businessId` | Business details |
| PUT | `/businesses/:businessId` | Update business |
| DELETE | `/businesses/:businessId` | Delete business |

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| GET | `/businesses/:businessId/dashboard` | Dashboard overview |
| GET | `/businesses/:businessId/dashboard/revenue` | Revenue overview |
| GET | `/businesses/:businessId/dashboard/sales` | Sales overview |
| GET | `/businesses/:businessId/dashboard/top-products` | Top products |
| GET | `/businesses/:businessId/dashboard/order-status` | Order distribution |

### Sales and Revenue

| Method | Endpoint | Description |
|---|---|---|
| GET | `/businesses/:businessId/sales` | Sales records |
| GET | `/businesses/:businessId/sales/analytics` | Sales analytics |
| GET | `/businesses/:businessId/sales/trends` | Sales trends |
| GET | `/businesses/:businessId/revenue` | Revenue records |
| GET | `/businesses/:businessId/revenue/analytics` | Revenue analytics |
| GET | `/businesses/:businessId/revenue/trends` | Revenue trends |

### Inventory and Products

| Method | Endpoint | Description |
|---|---|---|
| GET | `/businesses/:businessId/inventory` | Inventory |
| GET | `/businesses/:businessId/inventory/analytics` | Inventory analytics |
| GET | `/businesses/:businessId/inventory/low-stock` | Low stock |
| GET | `/businesses/:businessId/inventory/movements` | Stock movements |
| PUT | `/businesses/:businessId/inventory/:productId` | Update stock |
| POST | `/businesses/:businessId/products` | Add product |
| GET | `/businesses/:businessId/products` | List products |
| GET | `/businesses/:businessId/products/:productId` | Product details |
| PUT | `/businesses/:businessId/products/:productId` | Update product |
| DELETE | `/businesses/:businessId/products/:productId` | Delete product |

### Customers and Orders

| Method | Endpoint | Description |
|---|---|---|
| GET | `/businesses/:businessId/customers` | Customers |
| GET | `/businesses/:businessId/customers/analytics` | Customer analytics |
| GET | `/businesses/:businessId/customers/:customerId` | Customer details |
| GET | `/businesses/:businessId/orders` | Orders |
| GET | `/businesses/:businessId/orders/:orderId` | Order details |

### Reports

| Method | Endpoint | Description |
|---|---|---|
| GET | `/businesses/:businessId/reports` | List reports |
| POST | `/businesses/:businessId/reports/generate` | Generate report |
| GET | `/businesses/:businessId/reports/:reportId` | Report details |
| GET | `/businesses/:businessId/reports/:reportId/export` | Export report |

---

# 10. MongoDB Database Requirements

## 10.1 Database Configuration

The application will use MongoDB as its primary database and Prisma ORM as the database abstraction layer.

Database connection should be configured through an environment variable.

```env
DATABASE_URL="mongodb+srv://<username>:<password>@<cluster>/<database>"
```

Never commit database credentials to GitHub.

## 10.2 Prisma Configuration

The Prisma schema should use MongoDB as its datasource.

Example:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}
```

MongoDB models should use ObjectId identifiers.

Example:

```prisma
model User {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 10.3 Main Database Collections

### User

```text
User
----
id
name
email
password
profileImage
createdAt
updatedAt
```

### Business

```text
Business
--------
id
name
description
category
logo
currency
timezone
ownerId
createdAt
updatedAt
```

### BusinessMember

```text
BusinessMember
--------------
id
businessId
userId
role
createdAt
```

This collection will support future multi-user access and role-based permissions.

### Product

```text
Product
-------
id
businessId
name
description
sku
categoryId
price
costPrice
stockQuantity
minimumStockLevel
image
createdAt
updatedAt
```

### Category

```text
Category
--------
id
businessId
name
description
createdAt
```

### Customer

```text
Customer
--------
id
businessId
name
email
phone
createdAt
updatedAt
```

### Order

```text
Order
-----
id
businessId
customerId
orderNumber
totalAmount
discountAmount
taxAmount
refundAmount
paymentStatus
orderStatus
orderDate
createdAt
updatedAt
```

### OrderItem

```text
OrderItem
---------
id
orderId
productId
quantity
unitPrice
totalPrice
```

### InventoryMovement

```text
InventoryMovement
-----------------
id
businessId
productId
movementType
quantity
previousQuantity
newQuantity
reason
createdAt
```

### Report

```text
Report
------
id
businessId
userId
reportType
filters
fileUrl
status
createdAt
```

## 10.4 Database Relationships

- One user can own multiple businesses.
- One business can contain multiple products.
- One business can contain multiple customers.
- One business can contain multiple orders.
- One customer can have multiple orders.
- One order can contain multiple order items.
- One product can appear in multiple order items.
- One product can have multiple inventory movements.
- One business can have multiple reports.

These relationships should be implemented using MongoDB ObjectId references where appropriate.

For product and order data, consider embedding order item snapshots inside orders to preserve historical product names and prices even when the original product is updated or deleted.

## 10.5 MongoDB and Prisma Implementation Rules

- Use `String @db.ObjectId` for MongoDB document IDs and corresponding references.
- Use `@map("_id")` for MongoDB primary keys.
- Use `@unique` for unique identifiers such as email and business-specific SKUs where appropriate.
- Define indexes for frequently queried fields.
- Always filter business-owned records by `businessId`.
- Validate ObjectId inputs before database operations.
- Use Prisma Client for database operations.
- Use MongoDB aggregation pipelines when complex analytics queries require them.
- Avoid unnecessary document duplication.
- Preserve historical order information using snapshots.

**Important:** Prisma's MongoDB connector has different capabilities from its relational database connectors. MongoDB relations use references rather than relational foreign-key enforcement. Database transactions require a MongoDB replica set. Use supported Prisma schema features and verify connector compatibility before implementing migrations or advanced database operations.

For MongoDB, use `prisma db push` to synchronize supported schema changes rather than assuming relational migration workflows.

---

# 11. Frontend Architecture

## 11.1 Frontend Folder Structure

```text
frontend/
│
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── charts/
│   │   ├── tables/
│   │   └── forms/
│   │
│   ├── pages/
│   │   ├── Landing/
│   │   ├── Auth/
│   │   ├── Businesses/
│   │   ├── Dashboard/
│   │   ├── Sales/
│   │   ├── Revenue/
│   │   ├── Inventory/
│   │   ├── Products/
│   │   ├── Customers/
│   │   ├── Orders/
│   │   ├── Reports/
│   │   ├── Settings/
│   │   └── Profile/
│   │
│   ├── store/
│   │   ├── index.ts
│   │   └── slices/
│   │       ├── authSlice.ts
│   │       ├── businessSlice.ts
│   │       ├── dashboardSlice.ts
│   │       └── filterSlice.ts
│   │
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.service.ts
│   │   ├── business.service.ts
│   │   └── analytics.service.ts
│   │
│   ├── hooks/
│   ├── types/
│   ├── utils/
│   ├── routes/
│   ├── App.tsx
│   └── main.tsx
│
├── public/
├── package.json
└── tsconfig.json
```

## 11.2 Redux State Management

### Auth Slice

- Current user.
- Authentication status.
- User profile.

### Business Slice

- Business list.
- Active business ID.
- Active business details.
- Loading status.

### Dashboard Slice

- Dashboard statistics.
- Revenue chart data.
- Sales chart data.
- Top products.
- Order distribution.

### Filter Slice

- Selected date range.
- Custom date range.
- Selected product.
- Selected category.
- Selected order status.

Use Redux Toolkit Query or a consistent API caching strategy for server-side data.

---

# 12. Analytics Calculation Requirements

All calculations must follow consistent business rules.

## 12.1 Net Revenue

```text
Net Revenue =
Gross Item Revenue
- Discounts
- Refunds
```

Taxes and shipping charges should be handled separately.

## 12.2 Average Order Value

```text
AOV =
Eligible Order Revenue / Number of Eligible Orders
```

## 12.3 Total Customers

Count of unique customers belonging to the selected business.

## 12.4 Returning Customers

Customers who have placed more than one qualifying order.

## 12.5 Inventory Value

```text
Inventory Value =
Sum of (Current Stock × Unit Cost Price)
```

## 12.6 Sales Growth

```text
Sales Growth (%) =
((Current Period Sales - Previous Period Sales)
 / Previous Period Sales) × 100
```

Handle zero previous-period values separately.

All analytics must be calculated on the backend using business-specific records and consistent date, currency, and order-status rules.

---

# 13. Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | Users must register and log in. |
| FR-02 | Users must create multiple businesses. |
| FR-03 | Users must switch between businesses. |
| FR-04 | Each business must have independent data. |
| FR-05 | Users must view dashboard statistics. |
| FR-06 | Users must view sales analytics. |
| FR-07 | Users must view revenue analytics. |
| FR-08 | Users must monitor inventory. |
| FR-09 | Users must manage products. |
| FR-10 | Users must view customer analytics. |
| FR-11 | Users must view orders. |
| FR-12 | Users must generate reports. |
| FR-13 | Users must export reports. |
| FR-14 | Users must filter analytics by date. |
| FR-15 | Charts must update according to filters. |
| FR-16 | Users must edit business details. |
| FR-17 | Users must update their profiles. |
| FR-18 | Unauthorized business data access must be prevented. |
| FR-19 | The application must follow the defined Deep Blue, Pure White, and Bubblegum Pink theme. |

---

# 14. Non-Functional Requirements

## Performance

- Optimize dashboard queries.
- Use pagination for large tables.
- Use MongoDB indexes.
- Avoid unnecessary API requests.
- Optimize D3.js chart rendering.
- Cache frequently requested analytics where appropriate.

## Security

- Hash passwords securely.
- Use JWT authentication.
- Protect application routes.
- Verify business access on every business-specific API.
- Validate API inputs.
- Prevent unauthorized data access.
- Use environment variables for secrets.
- Configure CORS.
- Implement authentication rate limiting.

## Scalability

- Use modular backend services.
- Maintain reusable analytics services.
- Optimize MongoDB queries.
- Support multiple businesses per user.
- Prepare architecture for team accounts and integrations.

## Responsiveness

Support:
- Desktop.
- Laptop.
- Tablet.
- Mobile.

## Reliability

- Handle empty datasets.
- Handle API failures.
- Validate analytics calculations.
- Use appropriate transaction handling for related inventory and order updates.
- Maintain historical records.

---

# 15. Data Source and Integration Requirements

The initial application should support data through its own database and backend APIs.

Future integrations:
- Shopify.
- WooCommerce.
- Custom e-commerce websites.
- CSV imports.
- External order management systems.

Future integration capabilities:
- Connect external stores.
- Import products.
- Import historical orders.
- Synchronize inventory.
- Synchronize customers.
- Schedule automatic synchronization.
- Display synchronization status.

External integrations are not mandatory for the MVP.

---

# 16. Application Workflow

```text
START
  |
  v
Open Shoplytics
  |
  v
Login / Register
  |
  v
Authentication Successful
  |
  v
Business Selection
  |
  +-----------------------+
  |                       |
  v                       v
Create Business       Select Business
  |                       |
  v                       v
Save Business         Load Business
  |                       |
  +-----------+-----------+
              |
              v
       Analytics Dashboard
              |
      +-------+-------+
      |       |       |
      v       v       v
    Sales  Inventory Customers
      |       |       |
      v       v       v
   Reports Products  Orders
      |       |       |
      +-------+-------+
              |
              v
        Generate Reports
              |
              v
             END
```

---

# 17. MVP Development Phases

## Phase 1 – Project Setup

- Initialize React with TypeScript.
- Initialize Express with TypeScript.
- Configure MongoDB.
- Configure Prisma ORM.
- Configure Tailwind CSS theme.
- Configure Redux Toolkit.
- Implement authentication.
- Configure protected routes.

## Phase 2 – Business Management

- Business creation.
- Business listing.
- Business editing.
- Business deletion.
- Business switching.
- Business-level authorization.

## Phase 3 – Dashboard Development

- Dashboard layout.
- Sidebar.
- Top navigation.
- Statistics cards.
- Revenue charts.
- Sales charts.
- Order distribution.
- Date filters.

## Phase 4 – Analytics Modules

- Sales analytics.
- Revenue analytics.
- Inventory analytics.
- Product management.
- Customer analytics.
- Order management.

## Phase 5 – Reporting

- Sales reports.
- Inventory reports.
- Customer reports.
- Revenue reports.
- CSV export.
- PDF export.

## Phase 6 – UI/UX and Optimization

- Anime.js animations.
- Responsive design.
- Loading skeletons.
- Empty states.
- Error handling.
- Performance optimization.
- Security testing.

---

# 18. Testing Requirements

## Frontend Testing

- Component rendering.
- Form validation.
- Navigation.
- Redux state updates.
- Chart rendering.
- Responsive design.
- Business switching.

## Backend Testing

- Authentication APIs.
- Business APIs.
- Product APIs.
- Inventory APIs.
- Analytics APIs.
- Report generation.
- Business authorization.

## Integration Testing

- User registration.
- Business creation.
- Business switching.
- Dashboard retrieval.
- Date filtering.
- Report generation.
- Business data isolation.

## Critical Security Test

If User A owns Business A and User B owns Business B, User B must not access Business A by manually changing the business ID in an API request.

This must be tested automatically.

---

# 19. Acceptance Criteria

The application will be considered functional when:

1. Users can register and log in.
2. Users can create multiple businesses.
3. Users can switch between businesses.
4. Each business has independent data.
5. Dashboard statistics are retrieved from MongoDB through the backend.
6. Sales and revenue graphs display correct information.
7. Inventory reports display accurate stock information.
8. Customer reports display purchasing insights.
9. Orders can be listed and filtered.
10. Reports can be generated and exported.
11. Date filters update analytics.
12. Business data remains isolated.
13. The interface is responsive.
14. The defined application theme is consistently implemented.
15. Loading, empty, and error states are handled.

---

# 20. Future Enhancements

- AI-powered business insights.
- Sales forecasting.
- Inventory demand prediction.
- Automated low-stock notifications.
- Scheduled email reports.
- Multiple team members per business.
- Role-based access control.
- Custom dashboard widgets.
- Drag-and-drop dashboard customization.
- Real-time analytics.
- Profit and loss reports.
- Marketing analytics.
- Customer retention analysis.
- Cohort analysis.
- Shopify integration.
- WooCommerce integration.
- Multi-currency consolidated reporting.

---

# 21. Final Project Summary

Shoplytics will be a modern, scalable, multi-business e-commerce analytics platform.

It will allow users to manage multiple businesses from one account while maintaining independent datasets and analytics for each business.

### Main Modules

| Module | Purpose |
|---|---|
| Authentication | Secure access |
| Business Management | Multiple business management |
| Dashboard | Business overview |
| Sales Analytics | Sales performance |
| Revenue Analytics | Revenue insights |
| Inventory | Stock monitoring |
| Products | Product catalog |
| Customers | Customer behavior |
| Orders | Order monitoring |
| Reports | Business reporting |
| Settings | Business configuration |

### Final Technology Stack

- Frontend: React + TypeScript
- State Management: Redux Toolkit
- Styling: Tailwind CSS
- Animation: Anime.js
- Visualization: D3.js
- Backend: Node.js + Express.js + TypeScript
- ORM: Prisma ORM
- Database: MongoDB
- Authentication: JWT

### Final Design Theme

- Deep Blue: `#142B5C`
- Pure White: `#FFFFFF`
- Bubblegum Pink: `#FF85B3`

**Core Product Principle:**

One user → Multiple businesses → Independent business data → Dedicated analytics dashboards → Actionable business insights.

**Development Priority:** Data accuracy, business isolation, scalability, usability, and consistent visual design.

---

**End of Requirements Document**