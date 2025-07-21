
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Shield, Bell, Crown, HelpCircle, LogOut, ChevronRight, Star } from "lucide-react";

export const ProfileScreen = () => {
  const stats = [
    { label: "Days Active", value: "47", color: "text-green-600" },
    { label: "Goals Achieved", value: "8", color: "text-blue-600" },
    { label: "Insights Generated", value: "23", color: "text-purple-600" },
    { label: "Community Wins", value: "5", color: "text-yellow-600" }
  ];

  const settingsOptions = [
    { icon: User, label: "Account", description: "Personal information and preferences" },
    { icon: Shield, label: "Privacy & Data", description: "Your data security and privacy controls" },
    { icon: Bell, label: "Notifications", description: "Manage your notification preferences" },
    { icon: Crown, label: "Upgrade to Premium", description: "Unlock advanced insights and features" },
    { icon: HelpCircle, label: "Help & Support", description: "Get help and contact support" },
  ];

  return (
    <div className="p-6 pb-24 max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Profile</h1>
        <p className="text-gray-600">
          Your wellness journey overview
        </p>
      </div>

      {/* Profile Header */}
      <Card className="mb-6 shadow-md border-0 bg-gradient-to-r from-green-50 to-blue-50">
        <CardContent className="p-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">Alex Johnson</h2>
          <p className="text-gray-600 mb-4">Member since March 2024</p>
          
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings Options */}
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {settingsOptions.map((option, index) => (
              <button
                key={index}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  option.label === "Upgrade to Premium" ? "bg-yellow-100" : "bg-gray-100"
                }`}>
                  <option.icon className={`w-5 h-5 ${
                    option.label === "Upgrade to Premium" ? "text-yellow-600" : "text-gray-600"
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-800">{option.label}</span>
                    {option.label === "Upgrade to Premium" && (
                      <Star className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Privacy Assurance */}
      <Card className="mb-6 shadow-md border-0 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-800">Your Privacy Matters</h3>
              <p className="text-sm text-gray-600">
                All your data is encrypted and secure. You have complete control over your information.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button 
        variant="outline" 
        className="w-full py-3 rounded-full text-red-600 border-red-200 hover:bg-red-50"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Log Out
      </Button>
    </div>
  );
};
