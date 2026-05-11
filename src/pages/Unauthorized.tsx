import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="h-screen flex flex-col items-center justify-center p-6 text-center">
      <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-zinc-500 mb-6 max-w-sm">
        You don't have permission to access this portal. Please contact your administrator or try a different account.
      </p>
      <Link to="/login" className="btn-primary">
        Back to Login
      </Link>
    </div>
  );
}
