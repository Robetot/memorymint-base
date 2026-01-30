import React from 'react';
import { useNavigate } from 'react-router-dom';
import HopaGameWrapper from '@/components/weekly/HopaGameWrapper';

const WeeklyChallenge: React.FC = () => {
  const navigate = useNavigate();

  return (
    <HopaGameWrapper onBack={() => navigate('/')} />
  );
};

export default WeeklyChallenge;
