import { memo, useState } from 'react';
import { GraduationCap, Play, BookOpen, Award, Clock, Users, Star, CheckCircle, Video, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TrainingCenter = memo(function TrainingCenter() {
  const [activeTab, setActiveTab] = useState("courses");

  const courses = [
    {
      id: 1,
      title: "Electrical Safety Fundamentals",
      instructor: "Master Electrician John Smith",
      category: "Safety",
      level: "Beginner",
      duration: "4 hours",
      enrolled: 2847,
      rating: 4.9,
      price: "Free",
      description: "Essential electrical safety practices for residential and commercial work",
      modules: [
        { title: "Basic Electrical Theory", duration: "45 min", completed: true },
        { title: "Safety Equipment & PPE", duration: "30 min", completed: true },
        { title: "Code Requirements", duration: "60 min", completed: false },
        { title: "Hazard Recognition", duration: "45 min", completed: false }
      ],
      progress: 50,
      thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop",
      featured: true
    },
    {
      id: 2,
      title: "Advanced Plumbing Techniques",
      instructor: "Master Plumber Sarah Johnson",
      category: "Technical",
      level: "Advanced",
      duration: "8 hours",
      enrolled: 1234,
      rating: 4.8,
      price: "$99",
      description: "Professional plumbing installation and repair techniques for complex projects",
      modules: [
        { title: "Pipe Sizing & Materials", duration: "90 min", completed: false },
        { title: "Fixture Installation", duration: "120 min", completed: false },
        { title: "Drainage Systems", duration: "90 min", completed: false },
        { title: "Troubleshooting", duration: "60 min", completed: false }
      ],
      progress: 0,
      thumbnail: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=250&fit=crop",
      featured: true
    },
    {
      id: 3,
      title: "Business Management for Contractors",
      instructor: "Business Coach Mike Davis",
      category: "Business",
      level: "Intermediate",
      duration: "6 hours",
      enrolled: 3456,
      rating: 4.7,
      price: "$149",
      description: "Learn to run a successful contracting business with effective management strategies",
      modules: [
        { title: "Financial Planning", duration: "90 min", completed: true },
        { title: "Customer Relations", duration: "75 min", completed: true },
        { title: "Project Management", duration: "105 min", completed: true },
        { title: "Growth Strategies", duration: "90 min", completed: false }
      ],
      progress: 75,
      thumbnail: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=250&fit=crop",
      featured: false
    },
    {
      id: 4,
      title: "OSHA Construction Safety",
      instructor: "Safety Specialist Lisa Wang",
      category: "Safety",
      level: "All Levels",
      duration: "3 hours",
      enrolled: 5678,
      rating: 4.9,
      price: "Free",
      description: "Comprehensive OSHA safety training for construction workers and supervisors",
      modules: [
        { title: "OSHA Standards Overview", duration: "45 min", completed: false },
        { title: "Fall Protection", duration: "60 min", completed: false },
        { title: "Personal Protective Equipment", duration: "30 min", completed: false },
        { title: "Hazard Communication", duration: "45 min", completed: false }
      ],
      progress: 0,
      thumbnail: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=250&fit=crop",
      featured: true
    }
  ];

  const certifications = [
    {
      id: 1,
      name: "TradeScout Safety Certification",
      description: "Comprehensive safety training covering all major construction hazards",
      requirements: ["Complete 3 safety courses", "Pass final exam (80%)", "2 years experience"],
      earned: true,
      earnedDate: "2024-02-15",
      validUntil: "2027-02-15"
    },
    {
      id: 2,
      name: "Business Management Professional",
      description: "Advanced business skills for contractors and trade professionals",
      requirements: ["Complete business course series", "Submit business plan", "Peer review"],
      earned: false,
      progress: 67
    },
    {
      id: 3,
      name: "Technical Excellence Badge",
      description: "Recognition of advanced technical skills in your trade specialty",
      requirements: ["Complete advanced courses", "Portfolio submission", "Skills assessment"],
      earned: false,
      progress: 25
    }
  ];

  const learningPaths = [
    {
      id: 1,
      title: "New Contractor Starter Path",
      description: "Everything you need to start your contracting career",
      courses: 8,
      estimatedTime: "24 hours",
      enrolled: 1247,
      completed: 245
    },
    {
      id: 2,
      title: "Safety Professional Track",
      description: "Become a certified safety professional in construction",
      courses: 12,
      estimatedTime: "36 hours",
      enrolled: 856,
      completed: 142
    },
    {
      id: 3,
      title: "Business Growth Accelerator",
      description: "Scale your contracting business to the next level",
      courses: 10,
      estimatedTime: "30 hours",
      enrolled: 634,
      completed: 89
    }
  ];

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  return (
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Training Center</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Advance your skills with professional training courses and certifications
          </p>
        </div>

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Courses Enrolled</p>
                  <p className="text-2xl font-bold text-white">12</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Completed</p>
                  <p className="text-2xl font-bold text-green-400">8</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Certifications</p>
                  <p className="text-2xl font-bold text-orange-400">3</p>
                </div>
                <Award className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Learning Hours</p>
                  <p className="text-2xl font-bold text-purple-400">127</p>
                </div>
                <Clock className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-navy-800/50 backdrop-blur-sm">
            <TabsTrigger value="courses" className="data-[state=active]:bg-orange-600">Courses</TabsTrigger>
            <TabsTrigger value="paths" className="data-[state=active]:bg-orange-600">Learning Paths</TabsTrigger>
            <TabsTrigger value="certifications" className="data-[state=active]:bg-orange-600">Certifications</TabsTrigger>
            <TabsTrigger value="progress" className="data-[state=active]:bg-orange-600">My Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="mt-6">
            {/* Featured Courses */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-8">
              <CardHeader>
                <CardTitle className="text-white">Featured Courses</CardTitle>
                <p className="text-gray-400">Popular and highly-rated courses from industry experts</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {courses.filter(course => course.featured).map((course) => (
                    <div key={course.id} className="bg-navy-700/50 rounded-lg overflow-hidden hover:bg-navy-600/50 transition-colors">
                      <div className="relative">
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/50 rounded-full p-3">
                            <Play className="h-8 w-8 text-white" />
                          </div>
                        </div>
                        <div className="absolute top-4 left-4">
                          <Badge className={course.price === "Free" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}>
                            {course.price}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getLevelColor(course.level)}>
                            {course.level}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {course.category}
                          </Badge>
                        </div>
                        
                        <h3 className="text-white font-semibold text-lg mb-2">{course.title}</h3>
                        <p className="text-gray-400 text-sm mb-3">{course.description}</p>
                        
                        <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {course.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {course.enrolled.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                            {course.rating}
                          </span>
                        </div>

                        {course.progress > 0 && (
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-400">Progress</span>
                              <span className="text-white">{course.progress}%</span>
                            </div>
                            <Progress value={course.progress} className="h-2" />
                          </div>
                        )}

                        <Button className="w-full bg-orange-600 hover:bg-orange-700">
                          {course.progress > 0 ? 'Continue Learning' : 'Start Course'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* All Courses */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">All Courses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((course) => (
                    <div key={course.id} className="bg-navy-700/50 rounded-lg overflow-hidden hover:bg-navy-600/50 transition-colors">
                      <img
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-32 object-cover"
                      />
                      
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${getLevelColor(course.level)} text-xs`}>
                            {course.level}
                          </Badge>
                          <span className="text-orange-400 font-bold">{course.price}</span>
                        </div>
                        
                        <h4 className="text-white font-medium mb-2">{course.title}</h4>
                        <p className="text-gray-400 text-xs mb-3">By {course.instructor}</p>
                        
                        <div className="flex justify-between items-center text-xs text-gray-400 mb-3">
                          <span>{course.duration}</span>
                          <span>★ {course.rating}</span>
                        </div>

                        <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-700">
                          View Course
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paths" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {learningPaths.map((path) => (
                <Card key={path.id} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">{path.title}</CardTitle>
                    <p className="text-gray-400 text-sm">{path.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Courses</p>
                          <p className="text-white font-semibold">{path.courses}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Est. Time</p>
                          <p className="text-white font-semibold">{path.estimatedTime}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Completion Rate</span>
                          <span className="text-white">{Math.round((path.completed / path.enrolled) * 100)}%</span>
                        </div>
                        <Progress value={(path.completed / path.enrolled) * 100} className="h-2" />
                        <p className="text-gray-400 text-xs">{path.enrolled} enrolled, {path.completed} completed</p>
                      </div>

                      <Button className="w-full bg-orange-600 hover:bg-orange-700">
                        Start Learning Path
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="certifications" className="mt-6">
            <div className="space-y-6">
              {certifications.map((cert) => (
                <Card key={cert.id} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-white font-semibold text-lg">{cert.name}</h3>
                          {cert.earned && (
                            <Badge className="bg-green-600 hover:bg-green-700">
                              <Award className="h-3 w-3 mr-1" />
                              Earned
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-400 mb-4">{cert.description}</p>
                        
                        <div>
                          <h4 className="text-white font-medium mb-2">Requirements:</h4>
                          <ul className="space-y-1">
                            {cert.requirements.map((req, index) => (
                              <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                                <CheckCircle className="h-3 w-3 text-green-400" />
                                {req}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {cert.earned ? (
                          <div>
                            <p className="text-green-400 font-semibold">Earned {cert.earnedDate ? new Date(cert.earnedDate).toLocaleDateString() : 'Unknown'}</p>
                            <p className="text-gray-400 text-sm">Valid until {cert.validUntil ? new Date(cert.validUntil).toLocaleDateString() : 'Unknown'}</p>
                            <Button className="mt-3 bg-blue-600 hover:bg-blue-700">
                              Download Certificate
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <div className="text-center mb-3">
                              <div className="text-2xl font-bold text-orange-400">{cert.progress}%</div>
                              <div className="text-gray-400 text-sm">Complete</div>
                            </div>
                            <Progress value={cert.progress} className="h-2 w-24 mb-3" />
                            <Button className="bg-orange-600 hover:bg-orange-700">
                              Continue
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="progress" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Activity */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Recent Learning Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { course: "Electrical Safety Fundamentals", module: "Code Requirements", date: "2 hours ago", type: "completed" },
                      { course: "Business Management", module: "Growth Strategies", date: "Yesterday", type: "started" },
                      { course: "OSHA Construction Safety", module: "Fall Protection", date: "2 days ago", type: "completed" },
                      { course: "Advanced Plumbing", module: "Pipe Sizing", date: "3 days ago", type: "started" },
                    ].map((activity, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-navy-700/50 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.type === 'completed' ? 'bg-green-400' : 'bg-blue-400'
                        }`} />
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{activity.course}</p>
                          <p className="text-gray-400 text-xs">{activity.module}</p>
                        </div>
                        <div className="text-gray-400 text-xs">{activity.date}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Learning Stats */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Learning Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">This Week</span>
                        <span className="text-white">8.5 hours</span>
                      </div>
                      <Progress value={85} className="h-2" />
                      <p className="text-gray-400 text-xs mt-1">Goal: 10 hours/week</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Course Completion Rate</span>
                        <span className="text-white">67%</span>
                      </div>
                      <Progress value={67} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-navy-700/50 rounded-lg">
                        <div className="text-lg font-bold text-orange-400">15</div>
                        <div className="text-gray-400 text-xs">Courses Started</div>
                      </div>
                      <div className="text-center p-3 bg-navy-700/50 rounded-lg">
                        <div className="text-lg font-bold text-green-400">8</div>
                        <div className="text-gray-400 text-xs">Courses Completed</div>
                      </div>
                    </div>

                    <Button className="w-full bg-orange-600 hover:bg-orange-700">
                      View Detailed Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default TrainingCenter;