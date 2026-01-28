# Docsy – Real-time Collaborative Document Editor
![Logo](https://github.com/freakyash11/docsy/raw/main/assests/Screenshot/logo.png)
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
* Light and Dark mode support for comfortable writing

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
![Landing Page](https://github.com/freakyash11/docsy/raw/main/assests/Screenshot/landing-page.png)

2. **Authentication Page**
![Auth Page](https://github.com/freakyash11/docsy/raw/main/assests/Screenshot/auth-page.png)
> Secure authentication using Clerk

3. **Dashboard** (My Documents Page)
![Dashboard](https://github.com/freakyash11/docsy/raw/main/assests/Screenshot/dashboard.png)
> Rich text editor with real-time editing support

4. **Text Editor**
![Text Editor](https://github.com/freakyash11/docsy/raw/main/assests/Screenshot/text-editor.png)
> Rich text editor with real-time editing support

5. **Text Editor (Dark Mode)**
![Text Editor Dark Mode](https://github.com/freakyash11/docsy/raw/main/assests/Screenshot/text-editor-dark.png)
> Rich text editor in dark mode

6. **Editor Header**
![Editor Header](https://github.com/freakyash11/docsy/raw/main/assests/Screenshot/editor-header.png)
> Document header with collaborator presence and sharing controls

7. **Share Modal**
![Share Modal](https://github.com/freakyash11/docsy/raw/main/assests/Screenshot/share-modal.png)
> Share modal for managing collaborators and access permissions

## 🔐 Access Control
Docsy follows a simple and secure role-based access model:
* **Owner** - Full access, can manage collaborators and permissions
* **Editor** - Can edit document content
* **Viewer** - Read-only access
> Pending invitations and collaborator management are visible only to the document owner.

## 📌 Current Status
Implemented:
* Authentication
* Document CRUD and dashboard
* Real-time collaborative editing
* Autosave
* Sharing and permissions
* Collaborator presence indicators

## 🧭 Roadmap / Future Enhancements
* Comment system
* Version history UI
* AI-assisted writing tools
* Semantic search
* Image uploads using cloud storage
* Background jobs for cleanup and autosave
* Monitoring and logging

## 🏁 Conclusion
Docsy demonstrates a complete full-stack real-time application, combining modern frontend development, scalable backend architecture, real-time collaboration, and thoughtful UX design. The project reflects a strong understanding of collaborative systems, authentication, real-time data flow, and clean product-focused engineering.