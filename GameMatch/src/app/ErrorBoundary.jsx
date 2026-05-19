import React from "react";

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: String(error?.message || error || "Falha inesperada"),
    };
  }

  componentDidCatch(error) {
    console.error("GameMatch crashed:", error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="crash-screen">
          <div className="crash-screen__panel">
            <p className="eyebrow">GameMatch</p>
            <h1>Algo deu errado.</h1>
            <p className="muted">O aplicativo encontrou um erro interno e não conseguiu continuar com segurança.</p>
            <p className="crash-screen__message">{this.state.message}</p>
            <button className="button button--primary" type="button" onClick={this.handleReload}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
