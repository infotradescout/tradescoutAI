import { memo, useState } from "react";
import { GraduationCap, Play, BookOpen, Award, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Page, Section } from "@/components/layout/PagePrimitives";

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
      price: "Preview",
      description: "Essential electrical safety practices for residential and commercial work",
      modules: [
        { title: "Basic Electrical Theory", duration: "45 min" },
        { title: "Safety Equipment & PPE", duration: "30 min" },
        { title: "Code Requirements", duration: "60 min" },
        { title: "Hazard Recognition", duration: "45 min" },
      ],
      thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop",
      featured: true,
    },
    {
      id: 2,
      title: "Advanced Plumbing Techniques",
      instructor: "Master Plumber Sarah Johnson",
      category: "Technical",
      level: "Advanced",
      duration: "8 hours",
      price: "Preview",
      description: "Professional plumbing installation and repair techniques for complex projects",
      modules: [
        { title: "Pipe Sizing & Materials", duration: "90 min" },
        { title: "Fixture Installation", duration: "120 min" },
        { title: "Drainage Systems", duration: "90 min" },
        { title: "Troubleshooting", duration: "60 min" },
      ],
      thumbnail:
        "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=250&fit=crop",
      featured: true,
    },
    {
      id: 3,
      title: "Business Management for Contractors",
      instructor: "Business Coach Mike Davis",
      category: "Business",
      level: "Intermediate",
      duration: "6 hours",
      price: "Preview",
      description:
        "Learn to run a successful contracting business with effective management strategies",
      modules: [
        { title: "Financial Planning", duration: "90 min" },
        { title: "Customer Relations", duration: "75 min" },
        { title: "Project Management", duration: "105 min" },
        { title: "Growth Strategies", duration: "90 min" },
      ],
      thumbnail: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=250&fit=crop",
      featured: false,
    },
    {
      id: 4,
      title: "OSHA Construction Safety",
      instructor: "Safety Specialist Lisa Wang",
      category: "Safety",
      level: "All Levels",
      duration: "3 hours",
      price: "Preview",
      description: "Comprehensive OSHA safety training for construction workers and supervisors",
      modules: [
        { title: "OSHA Standards Overview", duration: "45 min" },
        { title: "Fall Protection", duration: "60 min" },
        { title: "Personal Protective Equipment", duration: "30 min" },
        { title: "Hazard Communication", duration: "45 min" },
      ],
      thumbnail:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=250&fit=crop",
      featured: true,
    },
  ];

  const certifications = [
    {
      id: 1,
      name: "TradeScout Safety Certification",
      description: "Comprehensive safety training covering all major construction hazards",
      requirements: ["Complete 3 safety courses", "Pass final exam (80%)", "2 years experience"],
    },
    {
      id: 2,
      name: "Business Management Professional",
      description: "Advanced business skills for contractors and trade professionals",
      requirements: ["Complete business course series", "Submit business plan", "Peer review"],
    },
    {
      id: 3,
      name: "Technical Excellence Badge",
      description: "Recognition of advanced technical skills in your trade specialty",
      requirements: ["Complete advanced courses", "Portfolio submission", "Skills assessment"],
    },
  ];

  const learningPaths = [
    {
      id: 1,
      title: "New Contractor Starter Path",
      description: "Everything you need to start your contracting career",
      courses: 8,
      estimatedTime: "24 hours",
    },
    {
      id: 2,
      title: "Safety Professional Track",
      description: "Become a certified safety professional in construction",
      courses: 12,
      estimatedTime: "36 hours",
    },
    {
      id: 3,
      title: "Business Growth Fundamentals",
      description: "Scale your contracting business to the next level",
      courses: 10,
      estimatedTime: "30 hours",
    },
  ];

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner":
        return "bg-primary/10 text-primary";
      case "Intermediate":
        return "bg-secondary/10 text-secondary-foreground";
      case "Advanced":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <>
      <SEOHelmet
        title="Training Center | Courses and Certifications"
        description="Build trade skills in the TradeScout training center with structured courses, certifications, and practical professional learning tracks."
        canonical="https://www.thetradescout.com/training-center"
      />
      <Page>
        <Section
          title={
            <span className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Training Center
            </span>
          }
          subtitle="Advance your skills with professional training courses and certifications"
        >
          {/* Progress Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Learning focus</p>
                    <p className="text-2xl font-bold text-white">Safety</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Course state</p>
                    <p className="text-2xl font-bold text-green-400">Preview</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Credentials</p>
                    <p className="text-2xl font-bold text-ts-orange">Planned</p>
                  </div>
                  <Award className="h-8 w-8 text-ts-orange" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Tracking</p>
                    <p className="text-2xl font-bold text-purple-400">Scoped</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-tsCard/50 backdrop-blur-sm">
              <TabsTrigger value="courses" className="data-[state=active]:bg-ts-orange-dark">
                Courses
              </TabsTrigger>
              <TabsTrigger value="paths" className="data-[state=active]:bg-ts-orange-dark">
                Learning Paths
              </TabsTrigger>
              <TabsTrigger value="certifications" className="data-[state=active]:bg-ts-orange-dark">
                Certifications
              </TabsTrigger>
              <TabsTrigger value="progress" className="data-[state=active]:bg-ts-orange-dark">
                My Progress
              </TabsTrigger>
            </TabsList>

            <TabsContent value="courses" className="mt-6">
              {/* Featured Courses */}
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm mb-8">
                <CardHeader>
                  <CardTitle className="text-white">Featured Courses</CardTitle>
                  <p className="text-white/60">
                    Priority course outlines selected for safety and operating clarity
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {courses
                      .filter((course) => course.featured)
                      .map((course) => (
                        <div
                          key={course.id}
                          className="bg-tsCard/50 rounded-lg overflow-hidden hover:bg-tsCard/50 transition-colors"
                        >
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
                              <Badge
                                className={
                                  course.price === "Free"
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-ts-orange-dark hover:bg-ts-orange-dark"
                                }
                              >
                                {course.price}
                              </Badge>
                            </div>
                          </div>

                          <div className="p-6">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getLevelColor(course.level)}>{course.level}</Badge>
                              <Badge variant="outline" className="text-xs">
                                {course.category}
                              </Badge>
                            </div>

                            <h3 className="text-white font-semibold text-lg mb-2">
                              {course.title}
                            </h3>
                            <p className="text-white/60 text-sm mb-3">{course.description}</p>

                            <div className="flex items-center gap-4 mb-4 text-sm text-white/60">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {course.duration}
                              </span>
                              <span>{course.category}</span>
                            </div>

                            <div className="rounded-md border border-white/10 bg-tsCard px-3 py-2 text-center text-sm text-white/70">
                              Course outline preview
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* All Courses */}
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">All Courses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => (
                      <div
                        key={course.id}
                        className="bg-tsCard/50 rounded-lg overflow-hidden hover:bg-tsCard/50 transition-colors"
                      >
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
                            <span className="text-ts-orange font-bold">{course.price}</span>
                          </div>

                          <h4 className="text-white font-medium mb-2">{course.title}</h4>
                          <p className="text-white/60 text-xs mb-3">By {course.instructor}</p>

                          <div className="flex justify-between items-center text-xs text-white/60 mb-3">
                            <span>{course.duration}</span>
                            <span>{course.category}</span>
                          </div>

                          <div className="rounded-md border border-white/10 bg-tsCard px-3 py-2 text-center text-sm text-white/70">
                            Course outline
                          </div>
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
                  <Card key={path.id} className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-white">{path.title}</CardTitle>
                      <p className="text-white/60 text-sm">{path.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-white/60">Courses</p>
                            <p className="text-white font-semibold">{path.courses}</p>
                          </div>
                          <div>
                            <p className="text-white/60">Est. Time</p>
                            <p className="text-white font-semibold">{path.estimatedTime}</p>
                          </div>
                        </div>

                        <div className="rounded-md border border-white/10 bg-tsCard px-3 py-2 text-center text-sm text-white/70">
                          Guided path outline
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="certifications" className="mt-6">
              <div className="space-y-6">
                {certifications.map((cert) => (
                  <Card key={cert.id} className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-semibold text-lg">{cert.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              Credential outline
                            </Badge>
                          </div>
                          <p className="text-white/60 mb-4">{cert.description}</p>

                          <div>
                            <h4 className="text-white font-medium mb-2">Requirements:</h4>
                            <ul className="space-y-1">
                              {cert.requirements.map((req, index) => (
                                <li
                                  key={index}
                                  className="flex items-center gap-2 text-sm text-white/70"
                                >
                                  <CheckCircle className="h-3 w-3 text-green-400" />
                                  {req}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="w-32 rounded-md border border-white/10 bg-tsCard px-3 py-2 text-center text-sm text-white/70">
                            Requirements only
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="progress" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Learning Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-white/60">
                      Personal learning activity will appear after real course progress is
                      connected.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Progress Tracking</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-white/60">
                      Progress reporting is held back until it can reflect real learning records.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </Section>
      </Page>
    </>
  );
});

export default TrainingCenter;
