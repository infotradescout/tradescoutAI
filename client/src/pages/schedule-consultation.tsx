import { memo, useState } from 'react';
import { Calendar, Clock, Users2, CheckCircle2, MapPin, Phone, Mail, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const ScheduleConsultation = memo(function ScheduleConsultation() {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [consultationType, setConsultationType] = useState('');
  const { toast } = useToast();

  const availableDates = [
    '2024-03-25',
    '2024-03-26',
    '2024-03-27',
    '2024-03-28',
    '2024-03-29'
  ];

  const availableTimes = [
    '09:00 AM',
    '10:00 AM',
    '11:00 AM',
    '01:00 PM',
    '02:00 PM',
    '03:00 PM',
    '04:00 PM'
  ];

  const consultationTypes = [
    { value: 'accelerator', label: 'Accelerator Program', duration: '45 min', description: 'Learn about premium features and benefits' },
    { value: 'business', label: 'Business Growth', duration: '30 min', description: 'Strategies for expanding your contractor business' },
    { value: 'platform', label: 'Platform Training', duration: '30 min', description: 'Get started with TradeScout features' },
    { value: 'technical', label: 'Technical Support', duration: '15 min', description: 'Resolve platform issues and questions' }
  ];

  const handleScheduleConsultation = () => {
    if (!selectedDate || !selectedTime || !consultationType) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields to schedule your consultation.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Consultation Scheduled!",
      description: `Your consultation has been scheduled for ${selectedDate} at ${selectedTime}.`,
    });
  };

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Calendar className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Schedule Consultation</h1>
          </div>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Book a personalized consultation with our team to discuss your business goals and how TradeScout can help you succeed
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Consultation Form */}
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users2 className="h-5 w-5" />
                Book Your Consultation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-white">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Smith"
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    className="bg-navy-700 border-navy-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    className="bg-navy-700 border-navy-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="text-white">Company Name (Optional)</Label>
                  <Input
                    id="company"
                    placeholder="Your Company LLC"
                    className="bg-navy-700 border-navy-600 text-white"
                  />
                </div>
              </div>

              {/* Consultation Type */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Consultation Type</h3>
                <Select value={consultationType} onValueChange={setConsultationType}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Select consultation type" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultationTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-sm text-gray-400">{type.duration} • {type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date & Time Selection */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Preferred Date & Time</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">Select Date</Label>
                    <Select value={selectedDate} onValueChange={setSelectedDate}>
                      <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                        <SelectValue placeholder="Choose date" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDates.map((date) => (
                          <SelectItem key={date} value={date}>
                            {new Date(date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Select Time</Label>
                    <Select value={selectedTime} onValueChange={setSelectedTime}>
                      <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                        <SelectValue placeholder="Choose time" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTimes.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-2">
                <Label htmlFor="message" className="text-white">What would you like to discuss? (Optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Tell us about your business goals, challenges, or specific topics you'd like to cover..."
                  className="bg-navy-700 border-navy-600 text-white"
                  rows={4}
                />
              </div>

              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={handleScheduleConsultation}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Consultation
              </Button>
            </CardContent>
          </Card>

          {/* Consultation Details */}
          <div className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  What to Expect
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Personalized Strategy</p>
                    <p className="text-gray-400 text-sm">Tailored advice for your specific business needs and goals</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Platform Demo</p>
                    <p className="text-gray-400 text-sm">Live walkthrough of features that will benefit your business</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Q&A Session</p>
                    <p className="text-gray-400 text-sm">Get answers to all your questions about TradeScout</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Next Steps</p>
                    <p className="text-gray-400 text-sm">Clear action plan for getting started and maximizing results</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Alternative Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-300">
                  Prefer to speak with someone right away? You can also reach our team directly:
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-orange-400" />
                    <span className="text-white">(555) 123-TRADE</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-orange-400" />
                    <span className="text-white">consultations@tradescout.com</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-orange-400" />
                    <span className="text-white">Mon-Fri 9 AM - 6 PM PST</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-navy-600">
                  <p className="text-gray-400 text-sm">
                    Our consultation team includes experienced contractors and business development specialists who understand your challenges.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Meeting Format
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">
                  All consultations are conducted via video call for your convenience. You'll receive a meeting link via email 24 hours before your scheduled time.
                </p>
                
                <div className="bg-navy-700 p-4 rounded-lg">
                  <p className="text-orange-400 font-medium mb-2">What You'll Need:</p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Stable internet connection</li>
                    <li>• Computer, tablet, or smartphone with camera</li>
                    <li>• Questions about your business goals</li>
                    <li>• Current challenges you'd like to address</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ScheduleConsultation;