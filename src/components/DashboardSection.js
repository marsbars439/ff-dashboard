import React from 'react';

const DashboardSection = ({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className = '',
  bodyClassName = ''
}) => {
  return (
    <section className={`dashboard-section ${className}`.trim()}>
      {(title || description || Icon || actions) && (
        <div className="dashboard-section__header">
          <div className="dashboard-section__title">
            {Icon && (
              <span className="dashboard-section__icon" aria-hidden="true">
                <Icon size={20} />
              </span>
            )}
            <div className="dashboard-section__title-text">
              {title && <h2>{title}</h2>}
              {description && <p>{description}</p>}
            </div>
          </div>
          {actions && <div className="dashboard-section__actions">{actions}</div>}
        </div>
      )}
      <div className={`dashboard-section__body ${bodyClassName}`.trim()}>
        {children}
      </div>
    </section>
  );
};

export default DashboardSection;
