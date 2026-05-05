package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
)

func main() {
	configPath := filepath.Join(".", "config.yaml")
	if len(os.Args) > 1 {
		configPath = os.Args[1]
	}

	cfg, err := LoadConfig(configPath)
	if err != nil {
		log.Fatalf("load config %s: %v", configPath, err)
	}

	resolved, err := cfg.Resolve(configPath)
	if err != nil {
		log.Fatalf("resolve config %s: %v", configPath, err)
	}

	app, err := NewApp(resolved)
	if err != nil {
		log.Fatalf("build app: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("run app: %v", err)
	}
}
