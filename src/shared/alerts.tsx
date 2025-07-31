import React from 'react';

type AlertProps = {
  message: string;
  type?: 'success' | 'danger' | 'warning' | 'info';
};

const AlertMessage: React.FC<AlertProps> = ({ message, type = 'info' }) => {
  return (
    <div
      className={`alert alert-${type} alert-dismissible fade show`}
      role="alert"
    >
      {message}
    </div>
  );
};

export default AlertMessage;
