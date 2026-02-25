import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Star,
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  Briefcase,
  GraduationCap,
  Award,
  MessageSquare,
  Shield,
  CheckCircle,
  Building,
  User,
} from "lucide-react";

interface WorkExperience {
  jobTitle: string;
  company: string;
  startDate: string;
  endDate?: string;
  description: string;
  isCurrentJob: boolean;
  fromPlatform: boolean;
  taskId?: string;
}

interface Education {
  degree: string;
  school: string;
  graduationYear?: number;
  fieldOfStudy?: string;
}

interface Certification {
  name: string;
  issuer: string;
  issueDate: string;
  expirationDate?: string;
  credentialId?: string;
}

interface PortfolioItem {
  title: string;
  description: string;
  imageUrl?: string;
  completionDate: string;
  skills: string[];
  fromPlatform: boolean;
  taskId?: string;
}

interface Helper {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  bio?: string;
  skills?: string[];
  hourlyRate?: string;
  averageRating?: string;
  totalJobsCompleted: number;
  isIdVerified: boolean;
  isBackgroundChecked: boolean;
  verificationStatus: string;
  workExperience?: WorkExperience[];
  education?: Education[];
  certifications?: Certification[];
  portfolioItems?: PortfolioItem[];
  city?: string;
  transportationMethod?: string;
  maxTravelDistance?: number;
  isAvailable: boolean;
}

interface HelperProfileModalProps {
  helper: Helper;
  isOpen: boolean;
  onClose: () => void;
}

export function HelperProfileModal({ helper, isOpen, onClose }: HelperProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "experience" | "portfolio" | "reviews">(
    "overview"
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  };

  const platformJobs = helper.workExperience?.filter((exp) => exp.fromPlatform) || [];
  const otherJobs = helper.workExperience?.filter((exp) => !exp.fromPlatform) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-popover border-border">
        <DialogHeader className="pb-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={helper.profileImageUrl} />
              <AvatarFallback className="bg-accent text-accent-foreground text-lg">
                {getInitials(helper.firstName, helper.lastName)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold text-foreground mb-2">
                {helper.firstName} {helper.lastName}
              </DialogTitle>

              <div className="flex items-center gap-4 mb-3">
                {helper.averageRating && (
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-warning fill-current mr-1" />
                    <span className="text-foreground font-medium">{helper.averageRating}</span>
                    <span className="text-muted-foreground ml-1">
                      ({helper.totalJobsCompleted} jobs)
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {helper.isIdVerified && (
                    <Badge className="bg-success/10 text-success-foreground border-success/30">
                      <Shield className="h-3 w-3 mr-1" />
                      ID Verified
                    </Badge>
                  )}
                  {helper.isBackgroundChecked && (
                    <Badge className="bg-info/10 text-info-foreground border-info/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Background Checked
                    </Badge>
                  )}
                  {helper.isAvailable && (
                    <Badge className="bg-success/10 text-success-foreground border-success/30">
                      Available
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {helper.city && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{helper.city}</span>
                  </div>
                )}
                {helper.hourlyRate && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    <span>${helper.hourlyRate}/hr</span>
                  </div>
                )}
                {helper.maxTravelDistance && (
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>Travels {helper.maxTravelDistance} miles</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="bg-orange-500 hover:bg-orange-600">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Helper
              </Button>
              <Button
                variant="outline"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                Hire for Job
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b border-navy-600 mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 font-medium ${
              activeTab === "overview"
                ? "text-orange-500 border-b-2 border-orange-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("experience")}
            className={`px-4 py-2 font-medium ${
              activeTab === "experience"
                ? "text-orange-500 border-b-2 border-orange-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Experience
          </button>
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`px-4 py-2 font-medium ${
              activeTab === "portfolio"
                ? "text-orange-500 border-b-2 border-orange-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Portfolio
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`px-4 py-2 font-medium ${
              activeTab === "reviews"
                ? "text-orange-500 border-b-2 border-orange-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            RECOMMENDATIONS
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "overview" && (
            <>
              {/* Bio */}
              {helper.bio && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">About</h3>
                  <p className="text-gray-300 leading-relaxed">{helper.bio}</p>
                </div>
              )}

              {/* Skills */}
              {helper.skills && helper.skills.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {helper.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="bg-navy-600 text-gray-300">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Transportation */}
              {helper.transportationMethod && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Transportation</h3>
                  <div className="text-gray-300">
                    <p>Method: {helper.transportationMethod}</p>
                    {helper.maxTravelDistance && (
                      <p>Travel radius: {helper.maxTravelDistance} miles</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Platform Jobs */}
              {platformJobs.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Recent TradeScout Jobs</h3>
                  <div className="space-y-3">
                    {platformJobs.slice(0, 3).map((job, index) => (
                      <div
                        key={index}
                        className="bg-navy-700 p-4 rounded-lg border border-navy-600"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-white">{job.jobTitle}</h4>
                            <p className="text-orange-400 text-sm">{job.company}</p>
                          </div>
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">
                            TradeScout
                          </Badge>
                        </div>
                        <p className="text-gray-300 text-sm mb-2">{job.description}</p>
                        <p className="text-gray-400 text-xs">
                          {formatDate(job.startDate)} -{" "}
                          {job.endDate ? formatDate(job.endDate) : "Present"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "experience" && (
            <div className="space-y-6">
              {/* Platform Jobs */}
              {platformJobs.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Briefcase className="h-5 w-5 mr-2 text-orange-500" />
                    TradeScout Experience
                  </h3>
                  <div className="space-y-4">
                    {platformJobs.map((job, index) => (
                      <div
                        key={index}
                        className="bg-navy-700 p-4 rounded-lg border border-navy-600"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-white">{job.jobTitle}</h4>
                            <p className="text-orange-400">{job.company}</p>
                          </div>
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">
                            Platform Job
                          </Badge>
                        </div>
                        <p className="text-gray-300 mb-3">{job.description}</p>
                        <p className="text-gray-400 text-sm">
                          {formatDate(job.startDate)} -{" "}
                          {job.endDate ? formatDate(job.endDate) : "Present"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Work Experience */}
              {otherJobs.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Building className="h-5 w-5 mr-2 text-blue-500" />
                    Other Experience
                  </h3>
                  <div className="space-y-4">
                    {otherJobs.map((job, index) => (
                      <div
                        key={index}
                        className="bg-navy-700 p-4 rounded-lg border border-navy-600"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-white">{job.jobTitle}</h4>
                            <p className="text-blue-400">{job.company}</p>
                          </div>
                          {job.isCurrentJob && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-300 mb-3">{job.description}</p>
                        <p className="text-gray-400 text-sm">
                          {formatDate(job.startDate)} -{" "}
                          {job.endDate ? formatDate(job.endDate) : "Present"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {helper.education && helper.education.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <GraduationCap className="h-5 w-5 mr-2 text-purple-500" />
                    Education
                  </h3>
                  <div className="space-y-3">
                    {helper.education.map((edu, index) => (
                      <div
                        key={index}
                        className="bg-navy-700 p-4 rounded-lg border border-navy-600"
                      >
                        <h4 className="font-medium text-white">{edu.degree}</h4>
                        <p className="text-purple-400">{edu.school}</p>
                        {edu.fieldOfStudy && (
                          <p className="text-gray-300 text-sm">{edu.fieldOfStudy}</p>
                        )}
                        {edu.graduationYear && (
                          <p className="text-gray-400 text-sm">Graduated {edu.graduationYear}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {helper.certifications && helper.certifications.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Award className="h-5 w-5 mr-2 text-yellow-500" />
                    Certifications
                  </h3>
                  <div className="space-y-3">
                    {helper.certifications.map((cert, index) => (
                      <div
                        key={index}
                        className="bg-navy-700 p-4 rounded-lg border border-navy-600"
                      >
                        <h4 className="font-medium text-white">{cert.name}</h4>
                        <p className="text-yellow-400">{cert.issuer}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-gray-400 text-sm">
                            Issued: {formatDate(cert.issueDate)}
                          </p>
                          {cert.expirationDate && (
                            <p className="text-gray-400 text-sm">
                              Expires: {formatDate(cert.expirationDate)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "portfolio" && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Portfolio</h3>
              {helper.portfolioItems && helper.portfolioItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helper.portfolioItems.map((item, index) => (
                    <div key={index} className="bg-navy-700 p-4 rounded-lg border border-navy-600">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-48 object-cover rounded-lg mb-3"
                        />
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-white">{item.title}</h4>
                        {item.fromPlatform && (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">
                            TradeScout
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm mb-3">{item.description}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.skills.map((skill, skillIndex) => (
                          <Badge
                            key={skillIndex}
                            variant="secondary"
                            className="text-xs bg-navy-600 text-gray-300"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-gray-400 text-xs">
                        Completed: {formatDate(item.completionDate)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No portfolio items yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "reviews" && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">RECOMMENDATIONS & Ratings</h3>
              <div className="text-center py-8">
                <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">RECOMMENDATIONS will be loaded here</p>
                <p className="text-gray-500 text-sm">
                  This feature connects to the worker RECOMMENDATIONS system
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
