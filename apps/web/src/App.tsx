import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { EventListing } from './pages/EventListing';
import { EventDetail } from './pages/EventDetail';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Privacy } from './pages/Privacy';
import { MyEvents } from './pages/MyEvents';
import { Profile } from './pages/Profile';
import { StudentFeedback } from './pages/StudentFeedback';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { CreateEvent } from './pages/CreateEvent';

const Msg: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="max-w-md mx-auto px-4 py-24 text-center">
    <h1 className="text-4xl font-black">{title}</h1>
    <p className="mt-2 text-slate-500">{text}</p>
  </div>
);

const Guard: React.FC<{
  roles?: string[];
  children: React.ReactElement;
}> = ({ roles, children }) => {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(loc.pathname)}`}
        replace
      />
    );
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <Msg
        title="403"
        text="You do not have access to this page."
      />
    );
  }

  return children;
};

const S = ['student'];
const O = ['organizer', 'admin'];

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={<Home onOpenTwoHours={() => {}} />}
          />

          <Route path="/events" element={<EventListing />} />

          <Route path="/events/:id" element={<EventDetail />} />

          <Route path="/login" element={<Login />} />

          <Route path="/signup" element={<Signup />} />

          <Route path="/privacy" element={<Privacy />} />

          <Route
            path="/me/events"
            element={
              <Guard>
                <MyEvents />
              </Guard>
            }
          />

          <Route
            path="/me/profile"
            element={
              <Guard>
                <Profile />
              </Guard>
            }
          />

          <Route
            path="/events/:id/feedback"
            element={
              <Guard roles={S}>
                <StudentFeedback />
              </Guard>
            }
          />

          <Route
            path="/organizer"
            element={
              <Guard roles={O}>
                <OrganizerDashboard />
              </Guard>
            }
          />

          <Route
            path="/organizer/create"
            element={
              <Guard roles={O}>
                <CreateEvent />
              </Guard>
            }
          />

          <Route
            path="*"
            element={
              <Msg
                title="404"
                text="That page doesn't exist."
              />
            }
          />
        </Routes>
      </main>

      <Footer />
    </div>
  );
};