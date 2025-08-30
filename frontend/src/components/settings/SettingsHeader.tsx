
interface SettingsHeaderProps {
  title: string;
  description: string;
}

const SettingsHeader = ({ title, description }: SettingsHeaderProps) => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-medical-800 mb-2">{title}</h1>
      <p className="text-medical-600">{description}</p>
    </div>
  );
};

export default SettingsHeader;
