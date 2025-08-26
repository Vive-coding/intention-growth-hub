
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Shield, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { User as UserType } from "@shared/schema";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export const ProfileScreen = () => {
  const { user, isLoading } = useAuth();
  const typedUser = user as UserType | undefined;

  const [firstName, setFirstName] = useState(typedUser?.firstName || "");
  const [lastName, setLastName] = useState(typedUser?.lastName || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      });
      window.location.reload();
    } catch (e) {
      console.error('Failed updating profile', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 pb-24 max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Account</h1>
        <p className="text-gray-600">Manage your profile details</p>
      </div>

      {/* Profile Header */}
      <Card className="mb-6 shadow-md border-0 bg-gradient-to-r from-green-50 to-blue-50">
        <CardContent className="p-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">
            {isLoading ? "Loading..." :
             (typedUser?.firstName && typedUser?.lastName ? `${typedUser.firstName} ${typedUser.lastName}` : typedUser?.email || "User")}
          </h2>
          <p className="text-gray-600 mb-1">
            Member since {typedUser?.createdAt ? new Date(typedUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
          </p>
        </CardContent>
      </Card>

      {/* Account form */}
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e)=> setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e)=> setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={typedUser?.email || ''} disabled />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || (!firstName && !lastName)}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy blurb retained */}
      <Card className="mb-6 shadow-md border-0 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-800">Your Privacy Matters</h3>
              <p className="text-sm text-gray-600">All your data is encrypted and secure. You have complete control over your information.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button 
        variant="outline" 
        className="w-full py-3 rounded-full text-red-600 border-red-200 hover:bg-red-50"
        onClick={()=>{ localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.reload(); }}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Log Out
      </Button>
    </div>
  );
};
