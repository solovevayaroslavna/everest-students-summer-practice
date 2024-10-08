package common

import (
	"testing"

	goversion "github.com/hashicorp/go-version"
	"github.com/stretchr/testify/assert"
)

func TestCompareVersions(t *testing.T) {
	t.Parallel()

	assert.Equal(t, int(0), CompareVersions("1.0.0", "1.0.0"))
	assert.Equal(t, int(0), CompareVersions("1.0.0", goversion.Must(goversion.NewVersion("1.0.0"))))
	assert.Equal(t, int(0), CompareVersions("1.0.0-rc1", goversion.Must(goversion.NewVersion("1.0.0"))))
	assert.Equal(t, int(1), CompareVersions("1.0.0", "0.9.0"))
	assert.Equal(t, int(1), CompareVersions("1.0.0", goversion.Must(goversion.NewVersion("0.9.0"))))
	assert.Equal(t, int(1), CompareVersions(goversion.Must(goversion.NewVersion("1.0.0")), "0.10.1"))
	assert.Equal(t, int(1), CompareVersions(goversion.Must(goversion.NewVersion("1.0.0-rc1")), "0.10.1"))
	assert.Equal(t, int(-1), CompareVersions("1.0.0", "1.1.0"))
	assert.Equal(t, int(-1), CompareVersions("1.0.0", goversion.Must(goversion.NewVersion("1.1.0"))))
	assert.Equal(t, int(-1), CompareVersions("1.0.0-rc1", goversion.Must(goversion.NewVersion("1.1.0"))))
}

func TestCheckConstraints(t *testing.T) {
	t.Parallel()

	assert.True(t, CheckConstraint("1.0.0", ">= 1.0.0"))
	assert.True(t, CheckConstraint(goversion.Must(goversion.NewVersion("1.0.0")), ">= 0.9.0"))
	assert.True(t, CheckConstraint("1.0.0", ">= 0.9.0, < 1.1.0"))
	assert.True(t, CheckConstraint(goversion.Must(goversion.NewVersion("1.0.0")), ">= 0.9.0, < 1.0.1"))
	assert.False(t, CheckConstraint("1.0.0", "< 1.0.0"))
	assert.True(t, CheckConstraint("1.1.0", "~> 1.1.0"))
	assert.False(t, CheckConstraint("1.2.0", "~> 1.1.0"))
	assert.True(t, CheckConstraint("1.2.0-rc1", "~> 1.2.0"))
	assert.True(t, CheckConstraint("1.2.1-rc1", "~> 1.2.0"))
	assert.False(t, CheckConstraint("1.3.1-rc1", "~> 1.2.0"))
	assert.True(t, CheckConstraint("1.3.1-rc1", "> 1.2.0"))
}
