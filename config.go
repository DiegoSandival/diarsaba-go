package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	quicnet "github.com/DiegoSandival/synap2p-go"
	yaml "go.yaml.in/yaml/v2"
)

const (
	ModeServer = "server"
	ModeClient = "client"

	defaultServerListenAddr = ":8080"
	defaultClientListenAddr = "127.0.0.1:8080"
	defaultIndexPath        = "./cards/index.html"
	defaultWSPath           = "/ws"
	defaultRequestTimeout   = 10 * time.Second
	defaultSynapDataDir     = "./data/synap2p"
	defaultSamsaraDBPath    = "./data/samsara"
)

type Config struct {
	Mode           string         `json:"mode" yaml:"mode"`
	ListenAddr     string         `json:"listen_addr,omitempty" yaml:"listen_addr,omitempty"`
	PublicHost     string         `json:"public_host,omitempty" yaml:"public_host,omitempty"`
	APIHost        string         `json:"api_host,omitempty" yaml:"api_host,omitempty"`
	IndexPath      string         `json:"index_path,omitempty" yaml:"index_path,omitempty"`
	WSPath         string         `json:"ws_path,omitempty" yaml:"ws_path,omitempty"`
	RequestTimeout string         `json:"request_timeout,omitempty" yaml:"request_timeout,omitempty"`
	Logging        LoggingConfig  `json:"logging,omitempty" yaml:"logging,omitempty"`
	Synap2P        quicnet.Config `json:"synap2p" yaml:"synap2p"`
	Samsara        SamsaraConfig  `json:"samsara" yaml:"samsara"`
}

type LoggingConfig struct {
	Enabled bool `json:"enabled,omitempty" yaml:"enabled,omitempty"`
}

type SamsaraConfig struct {
	DBPath string `json:"db_path,omitempty" yaml:"db_path,omitempty"`
}

type resolvedConfig struct {
	mode           string
	listenAddr     string
	publicHost     string
	apiHost        string
	indexPath      string
	wsPath         string
	logEnabled     bool
	requestTimeout time.Duration
	synap2p        quicnet.Config
	samsaraDBPath  string
	configDir      string
}

func LoadConfig(path string) (Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read file: %w", err)
	}

	var cfg Config
	switch strings.ToLower(filepath.Ext(path)) {
	case ".yaml", ".yml":
		err = yaml.Unmarshal(data, &cfg)
	case ".json":
		err = json.Unmarshal(data, &cfg)
	default:
		if err = json.Unmarshal(data, &cfg); err != nil {
			err = yaml.Unmarshal(data, &cfg)
		}
	}
	if err != nil {
		return Config{}, fmt.Errorf("parse file: %w", err)
	}

	applyEnvOverrides(&cfg)

	return cfg, nil
}

func applyEnvOverrides(cfg *Config) {
	if cfg == nil {
		return
	}

	applyStringEnv(&cfg.Mode, "DIARSABA_MODE")
	applyStringEnv(&cfg.ListenAddr, "DIARSABA_LISTEN_ADDR")
	applyStringEnv(&cfg.PublicHost, "DIARSABA_PUBLIC_HOST")
	applyStringEnv(&cfg.APIHost, "DIARSABA_API_HOST")
	applyStringEnv(&cfg.IndexPath, "DIARSABA_INDEX_PATH")
	applyStringEnv(&cfg.WSPath, "DIARSABA_WS_PATH")
	applyStringEnv(&cfg.RequestTimeout, "DIARSABA_REQUEST_TIMEOUT")
	applyBoolEnv(&cfg.Logging.Enabled, "DIARSABA_LOG_ENABLED")

	applyIntEnv(&cfg.Synap2P.ListenPort, "DIARSABA_SYNAP2P_LISTEN_PORT")
	applyStringEnv(&cfg.Synap2P.DataDir, "DIARSABA_SYNAP2P_DATA_DIR")
	applyStringEnv(&cfg.Synap2P.KeyPath, "DIARSABA_SYNAP2P_KEY_PATH")
	applyStringEnv(&cfg.Synap2P.Namespace, "DIARSABA_SYNAP2P_NAMESPACE")
	applyStringEnv(&cfg.Synap2P.AppID, "DIARSABA_SYNAP2P_APP_ID")
	applyStringEnv(&cfg.Synap2P.ProtocolPrefix, "DIARSABA_SYNAP2P_PROTOCOL_PREFIX")
	applyCSVEnv(&cfg.Synap2P.ListenAddrs, "DIARSABA_SYNAP2P_LISTEN_ADDRS")
	applyCSVEnv(&cfg.Synap2P.BootstrapList, "DIARSABA_SYNAP2P_BOOTSTRAP_LIST")
	applyCSVEnv(&cfg.Synap2P.StaticRelays, "DIARSABA_SYNAP2P_STATIC_RELAYS")

	applyStringEnv(&cfg.Samsara.DBPath, "DIARSABA_SAMSARA_DB_PATH")
}

func applyStringEnv(target *string, key string) {
	value, ok := os.LookupEnv(key)
	if !ok {
		return
	}
	*target = strings.TrimSpace(value)
}

func applyIntEnv(target *int, key string) {
	value, ok := os.LookupEnv(key)
	if !ok {
		return
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		return
	}
	*target = parsed
}

func applyCSVEnv(target *[]string, key string) {
	value, ok := os.LookupEnv(key)
	if !ok {
		return
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	*target = result
}

func applyBoolEnv(target *bool, key string) {
	value, ok := os.LookupEnv(key)
	if !ok {
		return
	}
	trimmed := strings.TrimSpace(strings.ToLower(value))
	switch trimmed {
	case "1", "true", "yes", "on":
		*target = true
	case "0", "false", "no", "off":
		*target = false
	}
}

func (cfg Config) Resolve(configPath string) (resolvedConfig, error) {
	configAbsPath, err := filepath.Abs(configPath)
	if err != nil {
		return resolvedConfig{}, fmt.Errorf("resolve config path: %w", err)
	}

	configDir := filepath.Dir(configAbsPath)
	mode, err := resolveMode(cfg.Mode)
	if err != nil {
		return resolvedConfig{}, err
	}

	listenAddr := strings.TrimSpace(cfg.ListenAddr)
	if listenAddr == "" {
		if mode == ModeServer {
			listenAddr = defaultServerListenAddr
		} else {
			listenAddr = defaultClientListenAddr
		}
	}

	requestTimeout, err := resolveRequestTimeout(cfg.RequestTimeout)
	if err != nil {
		return resolvedConfig{}, err
	}

	indexPath := cfg.IndexPath
	if strings.TrimSpace(indexPath) == "" {
		indexPath = defaultIndexPath
	}
	indexPath = resolveRelativePath(configDir, indexPath)

	wsPath := strings.TrimSpace(cfg.WSPath)
	if wsPath == "" {
		wsPath = defaultWSPath
	}
	if !strings.HasPrefix(wsPath, "/") {
		wsPath = "/" + wsPath
	}

	publicHost := normalizeHostName(cfg.PublicHost)
	apiHost := normalizeHostName(cfg.APIHost)
	if mode == ModeServer {
		if publicHost == "" {
			return resolvedConfig{}, fmt.Errorf("public_host is required in server mode")
		}
		if apiHost == "" {
			return resolvedConfig{}, fmt.Errorf("api_host is required in server mode")
		}
	}

	synapCfg := cfg.Synap2P
	if strings.TrimSpace(synapCfg.DataDir) == "" {
		synapCfg.DataDir = defaultSynapDataDir
	}
	synapCfg.DataDir = resolveRelativePath(configDir, synapCfg.DataDir)
	if strings.TrimSpace(synapCfg.KeyPath) != "" && filepath.IsAbs(synapCfg.KeyPath) == false && strings.TrimSpace(synapCfg.DataDir) == "" {
		synapCfg.KeyPath = resolveRelativePath(configDir, synapCfg.KeyPath)
	}
	if mode == ModeServer {
		synapCfg.Mode = quicnet.ModeHybrid
		synapCfg.EnableRelay = true
	} else {
		synapCfg.Mode = quicnet.ModeClient
		synapCfg.EnableRelay = false
	}

	samsaraDBPath := cfg.Samsara.DBPath
	if strings.TrimSpace(samsaraDBPath) == "" {
		samsaraDBPath = defaultSamsaraDBPath
	}
	samsaraDBPath = resolveRelativePath(configDir, samsaraDBPath)

	return resolvedConfig{
		mode:           mode,
		listenAddr:     listenAddr,
		publicHost:     publicHost,
		apiHost:        apiHost,
		indexPath:      indexPath,
		wsPath:         wsPath,
		logEnabled:     cfg.Logging.Enabled,
		requestTimeout: requestTimeout,
		synap2p:        synapCfg,
		samsaraDBPath:  samsaraDBPath,
		configDir:      configDir,
	}, nil
}

func resolveMode(mode string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(mode))
	if normalized == "" {
		normalized = ModeClient
	}

	switch normalized {
	case ModeServer, ModeClient:
		return normalized, nil
	default:
		return "", fmt.Errorf("unsupported mode %q", mode)
	}
}

func resolveRequestTimeout(value string) (time.Duration, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return defaultRequestTimeout, nil
	}

	timeout, err := time.ParseDuration(trimmed)
	if err != nil {
		return 0, fmt.Errorf("parse request_timeout: %w", err)
	}
	if timeout <= 0 {
		return 0, fmt.Errorf("request_timeout must be greater than zero")
	}
	return timeout, nil
}

func resolveRelativePath(baseDir, value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if filepath.IsAbs(trimmed) {
		return trimmed
	}
	return filepath.Join(baseDir, trimmed)
}

func normalizeHostName(host string) string {
	trimmed := strings.TrimSpace(host)
	trimmed = strings.TrimSuffix(trimmed, ".")
	return strings.ToLower(trimmed)
}
