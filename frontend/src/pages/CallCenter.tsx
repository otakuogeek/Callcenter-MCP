import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Clock, Calendar, MessageSquare, HeartPulse } from "lucide-react";

const CallCenter = () => {
  // Widget siempre visible: referenciador para el contenedor flotante
  const widgetContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Inyectar widget dentro del contenedor flotante
    if (widgetContainerRef.current) {
      widgetContainerRef.current.innerHTML = '';
      const widget = document.createElement('elevenlabs-convai');
      widget.setAttribute('agent-id', 'agent_4901k18tj07xejf80cwggbhwng41');
      widgetContainerRef.current.appendChild(widget);
    }

    // Inyectar el script del widget solo una vez
    if (!document.querySelector('script[src="https://unpkg.com/@elevenlabs/convai-widget-embed"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      script.type = 'text/javascript';
      document.body.appendChild(script);
    }
  }, []);

  const features = [
    {
      icon: <Phone className="h-6 w-6 text-primary" />,
      title: "Atención 24/7",
      description: "Siempre disponibles cuando nos necesites"
    },
    {
      icon: <Clock className="h-6 w-6 text-primary" />,
      title: "Respuesta Inmediata",
      description: "Sin tiempos de espera, atención instantánea"
    },
    {
      icon: <Calendar className="h-6 w-6 text-primary" />,
      title: "Agenda tu Cita",
      description: "Programa consultas médicas fácilmente"
    },
    {
      icon: <MessageSquare className="h-6 w-6 text-primary" />,
      title: "Chat Inteligente",
      description: "Asistente virtual con IA avanzada"
    },
    {
      icon: <HeartPulse className="h-6 w-6 text-primary" />,
      title: "Cuidado Personalizado",
      description: "Atención adaptada a tus necesidades"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/10 p-4">
      <div className="max-w-7xl mx-auto relative">
        <div className="space-y-8 py-12 opacity-100 transition-opacity duration-500">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
              Bienvenido a nuestro
              <span className="text-primary"> Centro de Llamadas</span>
            </h1>
            <p className="mx-auto max-w-[700px] text-gray-700 md:text-xl">
              Llame ahora a nuestro centro de llamadas: <strong>+576076911308</strong> — estamos disponibles para atenderle y programar su cita o resolver sus consultas.
            </p>
            <Button 
              size="lg"
              onClick={() => { window.location.href = 'tel:+576076911308'; }}
              className="mt-6 bg-primary hover:bg-primary/90"
            >
              Llamar +576076911308
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {features.map((feature, index) => (
              <div
                key={index}
                className="transform transition-all duration-300 hover:-translate-y-1"
              >
                <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <CardContent className="p-6 space-y-4">
                    <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

  {/* Widget flotante siempre visible (contenedor transparente, sin recuadro) */}
  <div ref={widgetContainerRef} className="fixed right-6 bottom-6 z-50" />
      </div>
    </div>
  );
};

export default CallCenter;
