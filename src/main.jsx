// src/main.jsx (หรือ index.jsx)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // ตรวจสอบให้แน่ใจว่าได้ import Tailwind CSS แล้ว

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);