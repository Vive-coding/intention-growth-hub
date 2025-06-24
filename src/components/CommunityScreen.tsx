
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Heart, Share2, Trophy } from "lucide-react";

export const CommunityScreen = () => {
  const friends = [
    { name: "Sarah M.", avatar: "🌸", streak: 12, lastWin: "Completed 30-day meditation challenge" },
    { name: "Alex K.", avatar: "🌟", streak: 8, lastWin: "Hit personal best in running" },
    { name: "Jamie L.", avatar: "🌈", streak: 15, lastWin: "Practiced gratitude for 2 weeks straight" }
  ];

  const communityWins = [
    { user: "Maya", avatar: "🦋", win: "Overcame fear of public speaking", likes: 12, time: "2h ago" },
    { user: "Chris", avatar: "🌊", win: "Maintained work-life balance for a month", likes: 8, time: "4h ago" },
    { user: "Taylor", avatar: "🌱", win: "Started a daily journaling habit", likes: 15, time: "6h ago" }
  ];

  return (
    <div className="p-6 pb-24 max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Community</h1>
        <p className="text-gray-600">
          Share your journey and celebrate together
        </p>
      </div>

      {/* Your Circle */}
      <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Your Circle</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-4">
            {friends.map((friend, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {friend.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-800">{friend.name}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {friend.streak} day streak
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{friend.lastWin}</p>
                </div>
              </div>
            ))}
          </div>
          
          <Button variant="outline" className="w-full rounded-full">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Friends
          </Button>
        </CardContent>
      </Card>

      {/* Community Wins */}
      <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            <span>Community Wins</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {communityWins.map((post, index) => (
              <div key={index} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-orange-500 rounded-full flex items-center justify-center text-white text-sm">
                    {post.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-gray-800">{post.user}</span>
                      <span className="text-xs text-gray-500">{post.time}</span>
                    </div>
                    <p className="text-gray-700 mb-2">{post.win}</p>
                    <div className="flex items-center space-x-4">
                      <button className="flex items-center space-x-1 text-gray-500 hover:text-red-500">
                        <Heart className="w-4 h-4" />
                        <span className="text-sm">{post.likes}</span>
                      </button>
                      <button className="flex items-center space-x-1 text-gray-500 hover:text-blue-500">
                        <Share2 className="w-4 h-4" />
                        <span className="text-sm">Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Share Your Win */}
      <Card className="shadow-md border-0 bg-gradient-to-r from-purple-500 to-pink-500">
        <CardContent className="p-4 text-center text-white">
          <Trophy className="w-8 h-8 mx-auto mb-3" />
          <h3 className="font-semibold mb-2">Share Your Latest Win</h3>
          <p className="text-purple-100 mb-4 text-sm">
            Celebrating your progress inspires others on their journey
          </p>
          <Button className="w-full bg-white text-purple-600 hover:bg-purple-50 rounded-full">
            Share a Win
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
