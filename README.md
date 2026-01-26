# Docsy – Real-time Collaborative Document Editor
![Logo](/docs/assests/logo.png)
Docsy is a lightweight, real-time collaborative web-based document editor inspired by tools like Google Docs, designed with a strong focus on simplicity, speed, and a distraction-free writing experience.

>Docs without the bulk.

Users can create documents, edit content collaboratively in real time, share documents with others, and manage access through a clean and intuitive interface.

## 🚀 Features
✅ Implemented **(MVP)**
* Secure authentication and session management using Clerk
* Document creation, editing, renaming, and deletion
* Clean, card-based My Documents dashboard
* Rich text editing with Quill
* Real-time collaborative editing using Socket IO
* Automatic background saving (autosave)
* Simple sharing via links and email invitations
* Role-based access control (Owner / Editor / Viewer)
* Collaborator presence indicators in the editor header

## 🛠 Tech Stack

#### Frontend
* **React** – Component-based UI using hooks and functional components
* **Tailwind CSS** – Utility-first styling
* **Quill** – Rich text editor
* **Socket IO Client** – Real-time communication
* **Clerk** – Authentication and user management
* **React Router** – Client-side routing
* **Lucide-react** – Icon library

#### Backend
* **Node.js & Express** – REST API server
* **MongoDB & Mongoose** – Database and ODM
* **Socket IO** – Real-time collaboration engine
* **Redis** – Socket IO adapter for scalability
* **Clerk** – Authentication middleware
* **SendGrid** – Email invitations
* **Handlebars** – Email templating

## 🧩 Architecture Overview
1. Users authenticate via Clerk
2. React frontend renders dashboard and editor
3. Document data is fetched and persisted using REST APIs
4. Real-time edits are synced using Socket.IO
5. Redis enables scalable socket communication
6. MongoDB stores documents, permissions, and metadata
7. SendGrid handles collaboration invitation emails

## 📸 Screenshots

1. **Landing Page**
![Landing Page](/docs/assests/landing-page.png)

2. **Authentication Page**
![Auth Page](/docs/assests/auth-page.png)
> Secure authentication using Clerk

3. **Dashboard** (My Documents Page)
