import React, { memo } from 'react';
import { Link } from 'react-router-dom';

const Breadcrumbs = ({ items }) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.id || index} className="breadcrumbs__item">
              {!isLast && item.path ? (
                <>
                  <Link
                    to={item.path}
                    className="breadcrumbs__link"
                    aria-label={`Go to ${item.label}`}
                  >
                    {item.label}
                  </Link>
                  <span className="breadcrumbs__separator" aria-hidden="true">
                    /
                  </span>
                </>
              ) : (
                <span
                  className="breadcrumbs__current"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default memo(Breadcrumbs);
