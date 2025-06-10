import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Designer } from '@/pages/Designer';
import { Home } from '@/pages/Home';
import { SavedPlans } from '@/pages/SavedPlans';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/designer" element={<Designer />} />
          <Route path="/plans" element={<SavedPlans />} />
          <Route path="/plan/:id" element={<Designer />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  );
}

export default App;
