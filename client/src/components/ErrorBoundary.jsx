import React from 'react';
import { Card } from './ui';
import { ErrorState } from './States';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ct-container py-5">
          <Card>
            <ErrorState
              title="Something went wrong"
              message="An unexpected rendering issue occurred on this page. Please try refreshing."
              error={this.state.error}
              onRetry={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            />
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
